import { resolve, join } from "path";
import { access, constants } from "fs/promises";
import { readManifest, MANIFEST_FILE } from "./manifest.ts";

type Status = "ok" | "warn" | "error";
interface Check { name: string; status: Status; message: string; fix?: string }

const FORBIDDEN_FILES = ["auth.json", ".env"];
const PI_GITIGNORE_PATTERNS = [".pi/npm/", ".pi/git/", ".pi/agent/", ".claude/settings.local.json"];
const REQUIRED_PACKAGES = ["npm:pi-subagents"];

async function checkManifest(target: string): Promise<Check> {
  const path = resolve(target, MANIFEST_FILE);
  if (await Bun.file(path).exists())
    return { name: "manifest", status: "ok", message: ".agent-workspace.json exists" };
  return {
    name: "manifest", status: "error",
    message: ".agent-workspace.json not found",
    fix: "Run /pi-workspace:scaffold first",
  };
}

async function checkManagedFiles(target: string): Promise<Check[]> {
  const manifest = await readManifest(target);
  if (!manifest) return [];
  const checks: Check[] = [];
  for (const rel of manifest.managedFiles) {
    const exists = await Bun.file(resolve(target, rel)).exists();
    checks.push({
      name: `file:${rel}`,
      status: exists ? "ok" : "error",
      message: exists ? `${rel} exists` : `${rel} missing`,
      fix: exists ? undefined : "Run /pi-workspace:scaffold --force to regenerate",
    });
  }
  return checks;
}

async function checkForbiddenFiles(target: string): Promise<Check> {
  for (const f of FORBIDDEN_FILES) {
    if (await Bun.file(resolve(target, f)).exists())
      return {
        name: "no-secrets", status: "error",
        message: `Forbidden file found: ${f}`,
        fix: `Remove ${f} from project`,
      };
  }
  return { name: "no-secrets", status: "ok", message: "No forbidden files" };
}

async function checkPiPackages(target: string): Promise<Check> {
  const settingsPath = resolve(target, ".pi", "settings.json");
  const f = Bun.file(settingsPath);
  if (!await f.exists())
    return { name: "pi-packages", status: "warn", message: ".pi/settings.json not found — pi install not yet run" };
  const settings = await f.json() as { packages?: string[] };
  const pkgs = settings.packages ?? [];
  const missing = REQUIRED_PACKAGES.filter((p) => !pkgs.includes(p));
  if (missing.length === 0)
    return { name: "pi-packages", status: "ok", message: `Required packages registered: ${REQUIRED_PACKAGES.join(", ")}` };
  return {
    name: "pi-packages", status: "error",
    message: `Missing packages: ${missing.join(", ")}`,
    fix: `pi install ${missing.join(" ")} -l`,
  };
}

async function checkGitignore(target: string): Promise<Check> {
  const f = Bun.file(resolve(target, ".gitignore"));
  if (!await f.exists())
    return { name: "gitignore", status: "warn", message: ".gitignore not found" };
  const content = await f.text();
  const missing = PI_GITIGNORE_PATTERNS.filter((p) => !content.includes(p));
  if (missing.length === 0)
    return { name: "gitignore", status: "ok", message: "Pi patterns present in .gitignore" };
  return {
    name: "gitignore", status: "warn",
    message: `Missing gitignore patterns: ${missing.join(", ")}`,
    fix: "Run /pi-workspace:scaffold to inject patterns",
  };
}

async function checkTaskExecutable(target: string): Promise<Check[]> {
  const tasks = ["agent", "agent-fork", "agent-shell"];
  const checks: Check[] = [];
  for (const name of tasks) {
    const path = resolve(target, ".mise", "tasks", name);
    try {
      await access(path, constants.X_OK);
      checks.push({ name: `exec:${name}`, status: "ok", message: `${name} is executable` });
    } catch {
      checks.push({
        name: `exec:${name}`, status: "warn",
        message: `${name} is not executable`,
        fix: `chmod +x .mise/tasks/${name}`,
      });
    }
  }
  return checks;
}

function print(checks: Check[]): void {
  const icons = { ok: "✓", warn: "⚠", error: "✗" };
  for (const c of checks) {
    console.log(`  ${icons[c.status]} [${c.name}] ${c.message}`);
    if (c.fix && c.status !== "ok") console.log(`       → ${c.fix}`);
  }
}

export async function runVerify(target: string): Promise<boolean> {
  console.log("\n[verify] Checking workspace...\n");
  const checks: Check[] = [
    await checkManifest(target),
    ...(await checkManagedFiles(target)),
    await checkForbiddenFiles(target),
    await checkPiPackages(target),
    await checkGitignore(target),
    ...(await checkTaskExecutable(target)),
  ];
  print(checks);
  const errors = checks.filter((c) => c.status === "error");
  const warns  = checks.filter((c) => c.status === "warn");
  console.log(`\n  ${errors.length} error(s), ${warns.length} warning(s)\n`);
  return errors.length === 0;
}
