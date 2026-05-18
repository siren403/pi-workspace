import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readManifest } from "./manifest.ts";
import { inspectProjectPiRuntime, PI_RUNTIME_TOOL, type ProjectPiRuntime } from "./pi-runtime.ts";
import { expectedTemplateContent, listTemplateFiles, TEMPLATE_DIR } from "./templates.ts";

export type PlanItem = { action: string; reason: string };

export interface StatusReport {
  skill: {
    version: string;
    subskills: string[];
    reinstallCommand: string;
  };
  target: {
    path: string;
    manifest: null | {
      manifestVersion: number;
      profile: string;
      templateRevision: string;
      managedFiles: number;
    };
    drift: {
      missing: string[];
      outOfSync: string[];
    };
    packages: string[];
    missingPackages: string[];
    agentOverrides: string[];
    promptSections: string[];
    missingGitignore: string[];
    projectPiRuntime: ProjectPiRuntime | null;
  };
  recommendedWorkflow: PlanItem[];
  optionalFollowups: PlanItem[];
  notNeeded: string[];
}

const SKILL_DIR = resolve(import.meta.dir, "../../..");
const REINSTALL_COMMAND = "npx skills add siren403/pi-workspace --full-depth";
const REQUIRED_PACKAGES = ["npm:pi-subagents"];
const PI_GITIGNORE_PATTERNS = [".pi/npm/", ".pi/git/", ".pi/agent/", ".claude/settings.local.json"];

async function exists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    if (!(await exists(path))) return null;
    return await Bun.file(path).json() as T;
  } catch {
    return null;
  }
}

async function listSubskills(): Promise<string[]> {
  const skillsDir = join(SKILL_DIR, "skills");
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const names: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (await exists(join(skillsDir, entry.name, "SKILL.md"))) names.push(entry.name);
    }
    return names.sort();
  } catch {
    return [];
  }
}

function intentIncludes(intent: string, words: string[]): boolean {
  const lower = intent.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function wantsProjectPiRuntimeUpdate(intent: string): boolean {
  const lower = intent.toLowerCase();
  const hasPi = /\bpi\b/.test(lower) || lower.includes("pi-") || lower.includes("pi_") || lower.includes("pi버전") || lower.includes("pi 버전") || lower.includes("pi 업데이트");
  const hasRuntimeSignal = [
    "pi update",
    "pi 업데이트",
    "update notice",
    "업데이트 안내",
    "sandbox pi",
    "샌드박스 pi",
    "sandbox 안 pi",
    "샌드박스 안 pi",
    "mise.lock pi",
    "lock에 구버전",
    "lock 구버전",
    "pi-coding-agent",
    "@earendil-works/pi-coding-agent",
  ].some((word) => lower.includes(word));
  const hasVersionUpdate = hasPi && ["version", "latest", "outdated", "업데이트", "최신", "버전", "구버전"].some((word) => lower.includes(word));
  return hasRuntimeSignal || hasVersionUpdate;
}

async function countManagedDrift(target: string): Promise<{ missing: string[]; outOfSync: string[] }> {
  const manifest = await readManifest(target);
  if (!manifest) return { missing: [], outOfSync: [] };

  const missing: string[] = [];
  const outOfSync: string[] = [];
  const candidates = [...new Set([...manifest.managedFiles, ...(await listTemplateFiles())])].sort();
  for (const relPath of candidates) {
    const dest = resolve(target, relPath);
    if (!(await exists(dest))) {
      missing.push(relPath);
      continue;
    }

    if (relPath === ".agent-workspace.json") continue;
    const template = join(TEMPLATE_DIR, relPath);
    if (!(await exists(template))) continue;
    const [actual, expected] = await Promise.all([
      Bun.file(dest).text(),
      expectedTemplateContent(target, relPath),
    ]);
    if (actual !== expected) outOfSync.push(relPath);
  }

  return { missing, outOfSync };
}

async function inspectTarget(target: string) {
  const absTarget = resolve(target);
  const manifest = await readManifest(absTarget);
  const drift = await countManagedDrift(absTarget);
  const settings = await readJson<{
    packages?: string[];
    agentOverrides?: Record<string, unknown>;
    subagents?: { agentOverrides?: Record<string, unknown> };
  }>(
    resolve(absTarget, ".pi", "settings.json"),
  );
  const packages = settings?.packages ?? [];
  const missingPackages = REQUIRED_PACKAGES.filter((pkg) => !packages.includes(pkg));
  const agentOverrides = {
    ...(settings?.subagents?.agentOverrides ?? {}),
    ...(settings?.agentOverrides ?? {}),
  };
  const promptText = await exists(resolve(absTarget, "AGENTS.md"))
    ? await Bun.file(resolve(absTarget, "AGENTS.md")).text()
    : "";
  const promptSections = [...promptText.matchAll(/<!--\s*pi-prompts:([^:]+):start\s*-->/g)].map((m) => m[1]);
  const gitignore = await exists(resolve(absTarget, ".gitignore"))
    ? await Bun.file(resolve(absTarget, ".gitignore")).text()
    : "";
  const missingGitignore = PI_GITIGNORE_PATTERNS.filter((pattern) => !gitignore.includes(pattern));

  return {
    absTarget,
    manifest,
    drift,
    packages,
    missingPackages,
    agentOverrideNames: Object.keys(agentOverrides),
    promptSections,
    missingGitignore,
  };
}

async function inspectSkill() {
  const packageJson = await readJson<{ version?: string }>(join(SKILL_DIR, "package.json"));
  const subskills = await listSubskills();
  return {
    version: packageJson?.version ?? "unknown",
    subskills,
  };
}

function buildPlan(intent: string, target: Awaited<ReturnType<typeof inspectTarget>>, projectPiRuntime: ProjectPiRuntime | null): PlanItem[] {
  const plan: PlanItem[] = [];
  const wantsPiRuntimeUpdate = wantsProjectPiRuntimeUpdate(intent);
  const wantsUpdate = !wantsPiRuntimeUpdate && intentIncludes(intent, ["update", "reinstall", "version", "latest", "업데이트", "재설치", "버전", "최신"]);
  const wantsSetup = intentIncludes(intent, ["setup", "scaffold", "init", "처음", "세팅", "생성", "초기"]);
  const wantsSubagents = intentIncludes(intent, ["subagent", "model", "서브에이전트", "모델"]);

  if (wantsUpdate) {
    plan.push({
      action: REINSTALL_COMMAND,
      reason: "refresh the installed skill before validating workspace state",
    });
  }

  plan.push({
    action: "/pi-workspace:doctor",
    reason: "validate mise/pi/yolobox/auth/writability before changing project files",
  });

  if (wantsPiRuntimeUpdate) {
    if (!projectPiRuntime?.configured) {
      plan.push({
        action: "inspect target .mise.toml",
        reason: `project pi runtime is not managed by target .mise.toml (${PI_RUNTIME_TOOL} was not found); do not run host/global pi update`,
      });
      return plan;
    } else if (!projectPiRuntime.environment.miseAvailable) {
      if (projectPiRuntime.environment.location === "sandbox") {
        if (target.drift.missing.includes(".yolobox.Dockerfile") || target.drift.outOfSync.includes(".yolobox.Dockerfile")) {
          plan.push({
            action: "exit sandbox, then run /pi-workspace:update from the host project root",
            reason: "sandbox has no mise and the managed .yolobox.Dockerfile is not current; refresh the Dockerfile so the next sandbox includes mise",
          });
          plan.push({
            action: "mise run pi",
            reason: "re-enter the sandbox after the managed Dockerfile refresh rebuilds the sandbox image",
          });
          return plan;
        }
        plan.push({
          action: "exit sandbox, then rerun /pi-workspace pi update from the host project root",
          reason: "sandbox has no mise, so the project pi runtime lock update must be planned from the host; do not run host/global pi update",
        });
        return plan;
      }
      plan.push({
        action: "install or activate mise on the host, then rerun /pi-workspace pi update",
        reason: `project pi runtime update requires mise; current environment is ${projectPiRuntime.environment.location}; do not run host/global pi update as a substitute`,
      });
      return plan;
    } else if (projectPiRuntime.checkError) {
      plan.push({
        action: "inspect project pi runtime manually",
        reason: `could not check project pi runtime freshness: ${projectPiRuntime.checkError}`,
      });
      return plan;
    } else if (projectPiRuntime.outdated) {
      if (projectPiRuntime.npmReleasePolicy?.hasFilters) {
        const filters = [
          projectPiRuntime.npmReleasePolicy.before ? `before=${projectPiRuntime.npmReleasePolicy.before}` : "",
          projectPiRuntime.npmReleasePolicy.minReleaseAge ? `min-release-age=${projectPiRuntime.npmReleasePolicy.minReleaseAge}` : "",
        ].filter(Boolean).join(", ");
        plan.push({
          action: "ask approval to temporarily relax npm release filters for this project pi runtime upgrade",
          reason: `npm release filters are active (${filters}); newest pi may be intentionally blocked unless the user approves a temporary policy override`,
        });
        plan.push({
          action: `NPM_CONFIG_BEFORE= NPM_CONFIG_MIN_RELEASE_AGE=0 mise upgrade --dry-run --local ${PI_RUNTIME_TOOL}`,
          reason: "show the exact project runtime upgrade plan with a one-command npm release-policy override; does not persist npm config changes",
        });
        plan.push({
          action: `NPM_CONFIG_BEFORE= NPM_CONFIG_MIN_RELEASE_AGE=0 mise upgrade --local ${PI_RUNTIME_TOOL}`,
          reason: "after approval, update target mise.lock and local mise tool cache with a one-command npm release-policy override",
        });
        plan.push({
          action: "mise exec -- pi --version",
          reason: "confirm the target project resolves the updated pi runtime",
        });
      } else {
        plan.push({
          action: `mise upgrade --dry-run --local ${PI_RUNTIME_TOOL}`,
          reason: `show project pi runtime update plan for ${target.absTarget}: ${projectPiRuntime.current} -> ${projectPiRuntime.latest}; does not run host/global pi update`,
        });
        plan.push({
          action: `mise upgrade --local ${PI_RUNTIME_TOOL}`,
          reason: projectPiRuntime.environment.location === "sandbox"
            ? "after user approval, update the mounted project mise.lock from inside the sandbox; host mise cache may still need install"
            : "after user approval, update target mise.lock and local mise tool cache for the project pi runtime only",
        });
        if (projectPiRuntime.environment.location === "sandbox") {
          plan.push({
            action: "exit sandbox, then run mise install from the host project root",
            reason: "sandbox mise cache may not be shared with host; host install prepares the updated runtime before re-entering",
          });
          plan.push({
            action: "mise run pi",
            reason: "re-enter the sandbox after host mise install so the new project pi runtime is used",
          });
          return plan;
        } else {
          plan.push({
            action: "mise exec -- pi --version",
            reason: "confirm the target project resolves the updated pi runtime",
          });
        }
      }
    } else {
      plan.push({
        action: "mise exec -- pi --version",
        reason: "project pi runtime is already current; confirm resolved version in target project",
      });
    }
  }

  if (!target.manifest) {
    plan.push({
      action: "/pi-workspace:scaffold",
      reason: wantsSetup ? "requested setup and no workspace manifest exists" : "no .agent-workspace.json found",
    });
    plan.push({
      action: "/pi-workspace:verify",
      reason: "verify generated workspace files after scaffold",
    });
    return plan;
  }

  if (target.drift.missing.length > 0 || target.drift.outOfSync.length > 0 || target.missingGitignore.length > 0) {
    plan.push({
      action: "/pi-workspace:update",
      reason: `managed file/template drift detected; show diff with mise run update -- --target ${target.absTarget} --diff, not git diff, then apply approved managed refresh`,
    });
    plan.push({
      action: "/pi-workspace:verify",
      reason: "confirm workspace after update",
    });
  } else {
    plan.push({
      action: "/pi-workspace:verify",
      reason: "workspace manifest exists and no managed drift was detected",
    });
  }

  if (target.missingPackages.length > 0) {
    plan.push({
      action: "mise trust --yes && mise exec -- pi install npm:pi-subagents -l",
      reason: `required pi packages are missing from project scope: ${target.missingPackages.join(", ")}`,
    });
    plan.push({
      action: "/pi-workspace:verify",
      reason: "confirm required pi packages after project-scope install",
    });
  }

  if (wantsSubagents || (target.agentOverrideNames.length === 0 && target.missingPackages.length === 0)) {
    plan.push({
      action: "/pi-workspace:subagents",
      reason: wantsSubagents ? "requested sub-agent/model setup" : "pi-subagents is installed but no agentOverrides were found",
    });
  }

  return plan;
}

function buildOptionalFollowups(intent: string, target: Awaited<ReturnType<typeof inspectTarget>>): PlanItem[] {
  const followups: PlanItem[] = [];
  const wantsPrompt = intentIncludes(intent, ["prompt", "agents", "프롬프트", "지침"]);
  const wantsReport = intentIncludes(intent, ["bug", "issue", "report", "버그", "이슈", "리포트"]);
  const wantsExtensions = intentIncludes(intent, [
    "extension",
    "package",
    "profile",
    "recipe",
    "feature",
    "statusline",
    "lsp",
    "quota",
    "codex",
    "opencode",
    "확장",
    "패키지",
    "프로필",
    "레시피",
    "상태라인",
  ]);

  if (wantsPrompt || target.promptSections.length === 0) {
    followups.push({
      action: "/pi-workspace:prompts suggest",
      reason: wantsPrompt ? "requested prompt/AGENTS.md work" : "optional: no pi-prompts sections found in AGENTS.md",
    });
  }

  if (wantsReport) {
    followups.push({
      action: "/pi-workspace:report",
      reason: "requested issue reporting",
    });
  }

  if (wantsExtensions) {
    followups.push({
      action: "/pi-workspace:extensions --profile <extension-profile>",
      reason: "requested extension/profile/feature guidance; recommendations are advisory and install only after explicit approval",
    });
  }

  return followups;
}

function buildSkipped(target: Awaited<ReturnType<typeof inspectTarget>>): string[] {
  const skipped: string[] = [];
  if (target.manifest) skipped.push("scaffold: workspace manifest already exists");
  if (target.agentOverrideNames.length > 0) skipped.push(`subagents: configured (${target.agentOverrideNames.join(", ")})`);
  if (target.missingPackages.length === 0) skipped.push("extensions: required package npm:pi-subagents is already registered");
  return skipped;
}

function printPlan(title: string, items: PlanItem[]): void {
  console.log(`\n[status] ${title}\n`);
  if (items.length === 0) {
    console.log("  none");
    return;
  }
  items.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.action}`);
    console.log(`     reason: ${item.reason}`);
  });
}

function printOptional(title: string, items: PlanItem[]): void {
  console.log(`\n[status] ${title}\n`);
  console.log("  These are not part of the approval request.");
  console.log("  Mention them only after the recommended workflow completes, unless the user explicitly asks now.");
  if (items.length === 0) {
    console.log("  none");
    return;
  }
  items.forEach((item) => {
    console.log(`  - ${item.action}`);
    console.log(`    reason: ${item.reason}`);
  });
}

function printSkipped(skipped: string[]): void {
  console.log("\n[status] Not needed now\n");
  if (skipped.length === 0) {
    console.log("  none");
    return;
  }
  for (const item of skipped) console.log(`  - ${item}`);
}

function printApprovalGuidance(plan: PlanItem[]): void {
  console.log("\n[status] Approval guidance\n");
  if (plan.length === 0) {
    console.log("  No required workflow is needed.");
    return;
  }
  console.log("  Ask for one approval to run only the recommended workflow end-to-end.");
  console.log("  After approval, execute the steps in order and continue until the workspace is usable or a real blocker appears.");
  if (plan.some((item) => item.action === "exit sandbox, then run mise install from the host project root")) {
    console.log("  This pi runtime update is running inside a sandbox with mise available.");
    console.log("  The mutating upgrade updates the mounted project mise.lock, but sandbox mise cache may not be shared with the host.");
    console.log("  After the upgrade, stop in the sandbox and tell the user to run mise install from the host project root before mise run pi.");
    console.log("  Do not run host/global pi update or global npm update for this workflow.");
  } else if (plan.some((item) => item.action === `mise upgrade --local ${PI_RUNTIME_TOOL}`)) {
    console.log("  Project pi runtime upgrade may update mise.lock and the local mise tool cache.");
    console.log("  Run the dry-run step first and report unexpected output before the mutating upgrade.");
    console.log("  Do not run host/global pi update or global npm update for this workflow.");
    console.log("  After success, tell the user to exit any existing sandbox/pi session and run mise run pi again.");
  } else if (plan.some((item) => item.action === "ask approval to temporarily relax npm release filters for this project pi runtime upgrade")) {
    console.log("  npm release filters are active, so the newest pi package may be intentionally blocked.");
    console.log("  Report the active npm before/min-release-age values and ask whether to use one-command env overrides for this project runtime upgrade.");
    console.log("  If approved, run the listed NPM_CONFIG_BEFORE= NPM_CONFIG_MIN_RELEASE_AGE=0 mise commands; do not persist npm config changes.");
    console.log("  Do not run raw pi update, global npm install/update, or repeated version guesses as a workaround.");
  } else if (plan.some((item) => item.action === "exit sandbox, then run /pi-workspace:update from the host project root")) {
    console.log("  This pi runtime update request was detected inside a sandbox without mise.");
    console.log("  The target Dockerfile is also stale, so refresh managed files from the host before trying the runtime update again.");
    console.log("  Do not run project runtime mutation from this sandbox.");
  } else if (plan.some((item) => item.action.includes("rerun /pi-workspace pi update"))) {
    console.log("  This pi runtime update request was detected inside a sandbox or unknown environment.");
    console.log("  Do not run project runtime mutation from here.");
    console.log("  Tell the user to exit the sandbox, run /pi-workspace pi update from the host project root, then run mise run pi again.");
  }
  console.log("  If /pi-workspace:update is needed, show the managed-file diff with mise run update -- --target <target> --diff.");
  console.log("  Do not use git diff for managed-file previews; the target may not be a git repository.");
  console.log("  Apply the managed refresh only after the diff approval.");
  console.log("  Do not include deferred optional follow-ups in this approval request.");
}

export async function buildStatusReport(targetArg: string, intent = ""): Promise<StatusReport> {
  const skill = await inspectSkill();
  const target = await inspectTarget(targetArg);
  const projectPiRuntime = wantsProjectPiRuntimeUpdate(intent)
    ? await inspectProjectPiRuntime(target.absTarget)
    : null;
  return {
    skill: {
      version: skill.version,
      subskills: skill.subskills,
      reinstallCommand: REINSTALL_COMMAND,
    },
    target: {
      path: target.absTarget,
      manifest: target.manifest
          ? {
            manifestVersion: target.manifest.manifestVersion,
            profile: target.manifest.profile,
            templateRevision: target.manifest.template.revision,
            managedFiles: target.manifest.managedFiles.length,
          }
        : null,
      drift: target.drift,
      packages: target.packages,
      missingPackages: target.missingPackages,
      agentOverrides: target.agentOverrideNames,
      promptSections: target.promptSections,
      missingGitignore: target.missingGitignore,
      projectPiRuntime,
    },
    recommendedWorkflow: buildPlan(intent, target, projectPiRuntime),
    optionalFollowups: buildOptionalFollowups(intent, target),
    notNeeded: buildSkipped(target),
  };
}

export function printStatusReport(report: StatusReport): void {
  console.log("\n[status] Skill install\n");
  console.log(`  version: ${report.skill.version}`);
  console.log(`  subskill definitions in package: ${report.skill.subskills.length ? report.skill.subskills.join(", ") : "none"}`);
  console.log(`  reinstall/update command: ${report.skill.reinstallCommand}`);
  console.log("  note: if direct /pi-workspace:* commands are unavailable, reinstall with --full-depth");

  console.log("\n[status] Target workspace\n");
  console.log(`  target: ${report.target.path}`);
  console.log(`  manifest: ${report.target.manifest ? `v${report.target.manifest.manifestVersion} (${report.target.manifest.profile})` : "missing"}`);
  if (report.target.manifest) {
    console.log(`  template revision: ${report.target.manifest.templateRevision}`);
    console.log(`  managed files: ${report.target.manifest.managedFiles}`);
    console.log(`  missing managed files: ${report.target.drift.missing.length ? report.target.drift.missing.join(", ") : "none"}`);
    console.log(`  out-of-sync managed files: ${report.target.drift.outOfSync.length ? report.target.drift.outOfSync.join(", ") : "none"}`);
  }
  console.log(`  pi packages: ${report.target.packages.length ? report.target.packages.join(", ") : "none"}`);
  console.log(`  missing required packages: ${report.target.missingPackages.length ? report.target.missingPackages.join(", ") : "none"}`);
  console.log(`  agentOverrides: ${report.target.agentOverrides.length ? report.target.agentOverrides.join(", ") : "none"}`);
  console.log(`  pi-prompts sections: ${report.target.promptSections.length ? report.target.promptSections.join(", ") : "none"}`);
  console.log(`  missing gitignore patterns: ${report.target.missingGitignore.length ? report.target.missingGitignore.join(", ") : "none"}`);
  if (report.target.projectPiRuntime) {
    const runtime = report.target.projectPiRuntime;
    console.log("\n[status] Project pi runtime\n");
    console.log(`  configured in target .mise.toml: ${runtime.configured ? "yes" : "no"}`);
    if (runtime.sourcePath) console.log(`  source: ${runtime.sourcePath}`);
    console.log(`  execution location: ${runtime.environment.location}`);
    console.log(`  mise available here: ${runtime.environment.miseAvailable ? "yes" : "no"}`);
    console.log(`  environment signals: ${runtime.environment.signals.length ? runtime.environment.signals.join(", ") : "none"}`);
    if (runtime.requested) console.log(`  requested: ${runtime.requested}`);
    if (runtime.current) console.log(`  current: ${runtime.current}`);
    if (runtime.latest) console.log(`  latest: ${runtime.latest}`);
    console.log(`  outdated: ${runtime.outdated ? "yes" : "no"}`);
    if (runtime.checkError) console.log(`  check error: ${runtime.checkError}`);
    if (runtime.npmReleasePolicy) {
      const policy = runtime.npmReleasePolicy;
      console.log(`  npm release filters: ${policy.hasFilters ? "active" : "none"}`);
      if (policy.before) console.log(`  npm before: ${policy.before}`);
      if (policy.minReleaseAge) console.log(`  npm min-release-age: ${policy.minReleaseAge}`);
      if (policy.checkError) console.log(`  npm policy check error: ${policy.checkError}`);
    }
    if (runtime.outdated) {
      console.log(`  update command: mise upgrade --local ${PI_RUNTIME_TOOL}`);
      if (runtime.environment.location === "host" && runtime.environment.miseAvailable) {
        console.log("  after update: exit any existing sandbox/pi session, then run mise run pi from the target project");
      } else if (runtime.environment.location === "sandbox" && runtime.environment.miseAvailable) {
        console.log("  sandbox update mode: update the mounted mise.lock here, then exit and run mise install from the host project root");
      } else {
        console.log("  update must be run from the host project root; exit the sandbox and rerun /pi-workspace pi update");
      }
    }
    console.log("  host/global pi update is not managed here");
  }

  printPlan("Recommended workflow", report.recommendedWorkflow);
  printApprovalGuidance(report.recommendedWorkflow);
  printOptional("Deferred optional follow-ups", report.optionalFollowups);
  printSkipped(report.notNeeded);
  console.log("");
}

export async function runStatus(targetArg: string, intent = "", json = false): Promise<void> {
  const report = await buildStatusReport(targetArg, intent);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  printStatusReport(report);
}
