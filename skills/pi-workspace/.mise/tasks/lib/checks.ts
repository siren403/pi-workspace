import { $ } from "bun";
import { stat } from "fs/promises";
import { resolve, join } from "path";
import { readManifest } from "./manifest.ts";

const TEMPLATES_DIR = resolve(import.meta.dir, "../../../templates/scaffold");
const AGENT_FILE_CONTENT: Record<string, string> = {
  "CLAUDE.md": "@AGENTS.md\n",
};

export type CheckStatus = "ok" | "warn" | "error";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  fix?: string;
}

async function commandExists(cmd: string): Promise<boolean> {
  const r = await $`which ${cmd}`.quiet().nothrow();
  return r.exitCode === 0;
}

async function checkMise(): Promise<CheckResult> {
  if (await commandExists("mise"))
    return { name: "mise", status: "ok", message: "mise installed" };
  return {
    name: "mise",
    status: "error",
    message: "mise not found",
    fix: "Install mise: https://mise.jdx.dev/getting-started.html",
  };
}

async function checkPi(): Promise<CheckResult> {
  if (await commandExists("pi"))
    return { name: "pi", status: "ok", message: "pi installed" };
  // mise npm: 백엔드로 설치된 경우 shim 경로 시도
  const shim = `${process.env.HOME}/.local/share/mise/shims/pi`;
  if (await Bun.file(shim).exists())
    return { name: "pi", status: "ok", message: "pi installed (mise shim)" };
  return {
    name: "pi",
    status: "warn",
    message: "pi not found — install via mise or npm",
    fix: "mise install  (if .mise.toml has pi)  or  npm install -g @earendil-works/pi-coding-agent",
  };
}

async function checkPiVersion(target: string): Promise<CheckResult> {
  const MIN = [0, 70, 0];
  // Prefer the target project's mise runtime so Node/npm-backed pi resolves from its .mise.toml.
  const abs = resolve(target);
  const cwd = await stat(abs).then((s) => s.isDirectory() ? abs : process.cwd()).catch(() => process.cwd());
  let r = await $`mise exec -- pi --version`.cwd(cwd).quiet().nothrow();
  if (r.exitCode !== 0) r = await $`pi --version`.cwd(cwd).quiet().nothrow();
  if (r.exitCode !== 0)
    return { name: "pi-version", status: "warn", message: "could not read pi version" };
  // pi --version writes to stdout; fall back to stderr if empty
  const raw = (r.stdout.toString().trim() || r.stderr.toString().trim());
  const parts = raw.split(".").map(Number);
  const ok =
    parts[0] > MIN[0] ||
    (parts[0] === MIN[0] && parts[1] > MIN[1]) ||
    (parts[0] === MIN[0] && parts[1] === MIN[1] && (parts[2] ?? 0) >= MIN[2]);
  if (ok) return { name: "pi-version", status: "ok", message: `pi ${raw}` };
  return {
    name: "pi-version",
    status: "warn",
    message: `pi ${raw} is below recommended 0.70.0`,
    fix: "pi update self",
  };
}

async function checkYolobox(): Promise<CheckResult> {
  if (await commandExists("yolobox"))
    return { name: "yolobox", status: "ok", message: "yolobox installed" };
  return {
    name: "yolobox",
    status: "warn",
    message: "yolobox not found (optional — needed for sandbox tasks)",
    fix: "Install yolobox: https://yolobox.dev",
  };
}

async function checkAuth(): Promise<CheckResult> {
  const path = `${process.env.HOME}/.pi/agent/auth.json`;
  const f = Bun.file(path);
  if (await f.exists())
    return { name: "pi-auth", status: "ok", message: "~/.pi/agent/auth.json exists" };
  return {
    name: "pi-auth",
    status: "warn",
    message: "~/.pi/agent/auth.json not found — auth mount will not work",
    fix: "Run pi and use /login to authenticate",
  };
}

async function checkTargetWritable(target: string): Promise<CheckResult> {
  const abs = resolve(target);
  const f = Bun.file(abs);
  // 경로가 없으면 부모 디렉토리 쓰기 가능 여부로 판단
  const checkPath = await f.exists() ? abs : resolve(abs, "..");
  const r = await $`test -w ${checkPath}`.quiet().nothrow();
  if (r.exitCode === 0)
    return { name: "target-writable", status: "ok", message: `${abs} is writable` };
  return {
    name: "target-writable",
    status: "error",
    message: `${abs} is not writable`,
  };
}

async function checkScaffoldSync(target: string): Promise<CheckResult | null> {
  const manifest = await readManifest(target);
  if (!manifest) return null;

  const outOfSync: string[] = [];
  for (const relPath of manifest.managedFiles) {
    if (relPath === ".agent-workspace.json") continue;
    const destContent = await Bun.file(resolve(target, relPath)).exists()
      ? await Bun.file(resolve(target, relPath)).text()
      : null;
    const templatePath = join(TEMPLATES_DIR, relPath);
    const expected = await Bun.file(templatePath).exists()
      ? await Bun.file(templatePath).text()
      : AGENT_FILE_CONTENT[relPath] ?? null;
    if (expected !== null && destContent !== expected) outOfSync.push(relPath);
  }

  if (outOfSync.length === 0)
    return { name: "scaffold-sync", status: "ok", message: "All managed files up to date" };
  return {
    name: "scaffold-sync",
    status: "warn",
    message: `${outOfSync.length} managed file(s) out of sync: ${outOfSync.join(", ")}`,
    fix: "/pi-workspace:scaffold  (또는 mise run scaffold -- --force --target <path>)",
  };
}

async function checkClaudeMd(target: string): Promise<CheckResult | null> {
  // 아직 scaffold 안 된 프로젝트는 CLAUDE.md가 없는 게 정상 — 스킵
  if (!await Bun.file(resolve(target, ".agent-workspace.json")).exists()) return null;
  const claudeBin = await $`which claude`.quiet().nothrow();
  const claudeDir = await stat(resolve(target, ".claude")).then(s => s.isDirectory()).catch(() => false);
  if (claudeBin.exitCode !== 0 && !claudeDir) return null; // Claude Code 미사용 환경 — 스킵
  if (await Bun.file(resolve(target, "CLAUDE.md")).exists())
    return { name: "claude-md", status: "ok", message: "CLAUDE.md exists" };
  return {
    name: "claude-md",
    status: "warn",
    message: "CLAUDE.md missing — Claude Code가 AGENTS.md 규칙을 읽지 못합니다",
    fix: "/pi-workspace:scaffold  (또는 mise run scaffold -- --target <path>)",
  };
}

async function checkNoSecret(target: string): Promise<CheckResult> {
  const abs = resolve(target);
  const forbidden = ["auth.json", ".env"];
  for (const f of forbidden) {
    if (await Bun.file(`${abs}/${f}`).exists()) {
      return {
        name: "no-secret",
        status: "error",
        message: `Forbidden file found in target: ${f}`,
        fix: `Remove ${f} from ${abs} before scaffolding`,
      };
    }
  }
  return { name: "no-secret", status: "ok", message: "No forbidden files in target" };
}

function print(results: CheckResult[]): void {
  for (const r of results) {
    const icon = r.status === "ok" ? "✓" : r.status === "warn" ? "⚠" : "✗";
    console.log(`  ${icon} [${r.name}] ${r.message}`);
    if (r.fix && r.status !== "ok") console.log(`       → ${r.fix}`);
  }
}

/** Returns 0 if no errors, 1 if any error. */
export async function runDoctor(target: string): Promise<number> {
  console.log("\n[doctor] Checking environment...\n");
  const raw = await Promise.all([
    checkMise(),
    checkPi(),
    checkPiVersion(target),
    checkYolobox(),
    checkAuth(),
    checkTargetWritable(target),
    checkNoSecret(target),
    checkScaffoldSync(target),
    checkClaudeMd(target),
  ]);
  const results = raw.filter((r): r is CheckResult => r !== null);
  print(results);
  const errors = results.filter((r) => r.status === "error");
  const warns = results.filter((r) => r.status === "warn");
  console.log(`\n  ${errors.length} error(s), ${warns.length} warning(s)\n`);
  return errors.length > 0 ? 1 : 0;
}
