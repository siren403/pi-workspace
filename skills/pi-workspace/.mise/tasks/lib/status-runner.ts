import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readManifest } from "./manifest.ts";

type PlanItem = { action: string; reason: string };

const SKILL_DIR = resolve(import.meta.dir, "../../..");
const TEMPLATE_DIR = join(SKILL_DIR, "templates", "scaffold");
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

async function countManagedDrift(target: string): Promise<{ missing: string[]; outOfSync: string[] }> {
  const manifest = await readManifest(target);
  if (!manifest) return { missing: [], outOfSync: [] };

  const missing: string[] = [];
  const outOfSync: string[] = [];
  for (const relPath of manifest.managedFiles) {
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
      Bun.file(template).text(),
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
  const agentOverrides = settings?.agentOverrides ?? settings?.subagents?.agentOverrides ?? {};
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

function buildPlan(intent: string, target: Awaited<ReturnType<typeof inspectTarget>>): PlanItem[] {
  const plan: PlanItem[] = [];
  const wantsUpdate = intentIncludes(intent, ["update", "reinstall", "version", "latest", "업데이트", "재설치", "버전", "최신"]);
  const wantsSetup = intentIncludes(intent, ["setup", "scaffold", "init", "처음", "세팅", "생성", "초기"]);
  const wantsPrompt = intentIncludes(intent, ["prompt", "agents", "프롬프트", "지침"]);
  const wantsSubagents = intentIncludes(intent, ["subagent", "model", "서브에이전트", "모델"]);
  const wantsReport = intentIncludes(intent, ["bug", "issue", "report", "버그", "이슈", "리포트"]);

  if (wantsUpdate) {
    plan.push({
      action: REINSTALL_COMMAND,
      reason: "project-scope skills.sh installs are refreshed by rerunning add; this overwrites the installed copy",
    });
  }

  plan.push({
    action: "mise run doctor -- --target <target>",
    reason: "validate mise/pi/yolobox/auth/writability before changing project files",
  });

  if (!target.manifest) {
    plan.push({
      action: "mise run scaffold -- --target <target>",
      reason: wantsSetup ? "requested setup and no workspace manifest exists" : "no .agent-workspace.json found",
    });
    plan.push({
      action: "mise run verify -- --target <target>",
      reason: "verify generated workspace files after scaffold",
    });
    return plan;
  }

  plan.push({
    action: "mise run verify -- --target <target>",
    reason: "workspace manifest exists, so check generated files and pi package registration",
  });

  if (target.drift.missing.length > 0 || target.drift.outOfSync.length > 0 || target.missingGitignore.length > 0) {
    plan.push({
      action: "mise run update -- --target <target> --diff",
      reason: "review managed file/template drift before overwriting anything",
    });
    plan.push({
      action: "mise run update -- --target <target> --force",
      reason: "apply managed file/template refresh after user approval",
    });
    plan.push({
      action: "mise run verify -- --target <target>",
      reason: "confirm workspace after update",
    });
  }

  if (wantsSubagents || (target.agentOverrideNames.length === 0 && target.missingPackages.length === 0)) {
    plan.push({
      action: "mise run subagents -- --target <target>",
      reason: wantsSubagents ? "requested sub-agent/model setup" : "pi-subagents is installed but no agentOverrides were found",
    });
  }

  if (wantsPrompt || target.promptSections.length === 0) {
    plan.push({
      action: "mise run prompts -- --target <target> --context",
      reason: wantsPrompt ? "requested prompt/AGENTS.md work" : "no pi-prompts sections found in AGENTS.md",
    });
  }

  if (wantsReport) {
    plan.push({
      action: "mise run report -- --target <target> --context",
      reason: "requested issue reporting",
    });
  }

  return plan;
}

export async function runStatus(targetArg: string, intent = ""): Promise<void> {
  const skill = await inspectSkill();
  const target = await inspectTarget(targetArg);
  const plan = buildPlan(intent, target);

  console.log("\n[status] Skill install\n");
  console.log(`  version: ${skill.version}`);
  console.log(`  subskill definitions in package: ${skill.subskills.length ? skill.subskills.join(", ") : "none"}`);
  console.log(`  reinstall/update command: ${REINSTALL_COMMAND}`);
  console.log("  note: if direct /pi-workspace:* commands are unavailable, reinstall with --full-depth");

  console.log("\n[status] Target workspace\n");
  console.log(`  target: ${target.absTarget}`);
  console.log(`  manifest: ${target.manifest ? `${target.manifest.version} (${target.manifest.profile})` : "missing"}`);
  if (target.manifest) {
    console.log(`  managed files: ${target.manifest.managedFiles.length}`);
    console.log(`  missing managed files: ${target.drift.missing.length ? target.drift.missing.join(", ") : "none"}`);
    console.log(`  out-of-sync managed files: ${target.drift.outOfSync.length ? target.drift.outOfSync.join(", ") : "none"}`);
  }
  console.log(`  pi packages: ${target.packages.length ? target.packages.join(", ") : "none"}`);
  console.log(`  missing required packages: ${target.missingPackages.length ? target.missingPackages.join(", ") : "none"}`);
  console.log(`  agentOverrides: ${target.agentOverrideNames.length ? target.agentOverrideNames.join(", ") : "none"}`);
  console.log(`  pi-prompts sections: ${target.promptSections.length ? target.promptSections.join(", ") : "none"}`);
  console.log(`  missing gitignore patterns: ${target.missingGitignore.length ? target.missingGitignore.join(", ") : "none"}`);

  console.log("\n[status] Suggested plan\n");
  plan.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.action}`);
    console.log(`     reason: ${item.reason}`);
  });
  console.log("\n  Review this plan with the user before running file-changing commands.\n");
}
