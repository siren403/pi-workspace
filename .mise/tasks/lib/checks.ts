import { $ } from "bun";
import { resolve } from "path";

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

async function checkPiVersion(): Promise<CheckResult> {
  const MIN = [0, 70, 0];
  const r = await $`pi --version`.quiet().nothrow();
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
  const results = await Promise.all([
    checkMise(),
    checkPi(),
    checkPiVersion(),
    checkYolobox(),
    checkAuth(),
    checkTargetWritable(target),
    checkNoSecret(target),
  ]);
  print(results);
  const errors = results.filter((r) => r.status === "error");
  const warns = results.filter((r) => r.status === "warn");
  console.log(`\n  ${errors.length} error(s), ${warns.length} warning(s)\n`);
  return errors.length > 0 ? 1 : 0;
}
