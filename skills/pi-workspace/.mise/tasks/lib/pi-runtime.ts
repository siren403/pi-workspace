import { resolve } from "node:path";
import { $ } from "bun";

export const PI_RUNTIME_TOOL = "npm:@earendil-works/pi-coding-agent";
export type RuntimeLocation = "host" | "sandbox" | "unknown";

export interface RuntimeEnvironment {
  location: RuntimeLocation;
  miseAvailable: boolean;
  signals: string[];
}

export interface ProjectPiRuntime {
  configured: boolean;
  requested?: string;
  current?: string;
  latest?: string;
  outdated: boolean;
  sourcePath?: string;
  checkError?: string;
  environment: RuntimeEnvironment;
}

interface MiseOutdatedEntry {
  requested?: string;
  current?: string;
  latest?: string;
  source?: {
    type?: string;
    path?: string;
  };
}

async function hasProjectPiRuntimeTool(target: string): Promise<boolean> {
  const configPath = resolve(target, ".mise.toml");
  if (!await Bun.file(configPath).exists()) return false;

  try {
    const parsed = Bun.TOML.parse(await Bun.file(configPath).text()) as {
      tools?: Record<string, unknown>;
    };
    return Object.prototype.hasOwnProperty.call(parsed.tools ?? {}, PI_RUNTIME_TOOL);
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function readText(path: string): Promise<string> {
  try {
    return await Bun.file(path).text();
  } catch {
    return "";
  }
}

async function commandExists(command: string): Promise<boolean> {
  const result = await $`which ${command}`.quiet().nothrow();
  return result.exitCode === 0;
}

export async function inspectRuntimeEnvironment(): Promise<RuntimeEnvironment> {
  const signals: string[] = [];
  const miseAvailable = await commandExists("mise");

  if (process.env.PI_WORKSPACE_SANDBOX === "1") signals.push("env:PI_WORKSPACE_SANDBOX=1");
  if (await fileExists("/.dockerenv")) signals.push("file:/.dockerenv");

  const cgroup = await readText("/proc/1/cgroup");
  if (/(docker|containerd|kubepods|podman|yolobox)/i.test(cgroup)) {
    signals.push("proc:/proc/1/cgroup");
  }

  let location: RuntimeLocation = "host";
  if (signals.length > 0) location = "sandbox";
  if (process.env.PI_WORKSPACE_TEST_RUNTIME_LOCATION === "sandbox") {
    location = "sandbox";
    signals.push("test:runtime-location=sandbox");
  } else if (process.env.PI_WORKSPACE_TEST_RUNTIME_LOCATION === "unknown") {
    location = "unknown";
    signals.push("test:runtime-location=unknown");
  } else if (process.env.PI_WORKSPACE_TEST_RUNTIME_LOCATION === "host") {
    location = "host";
    signals.push("test:runtime-location=host");
  }

  const testMiseAvailable = process.env.PI_WORKSPACE_TEST_MISE_AVAILABLE;
  return {
    location,
    miseAvailable: testMiseAvailable === undefined ? miseAvailable : testMiseAvailable === "1",
    signals,
  };
}

function fromOutdatedJson(jsonText: string, target: string): ProjectPiRuntime {
  const parsed = JSON.parse(jsonText || "{}") as Record<string, MiseOutdatedEntry>;
  const entry = parsed[PI_RUNTIME_TOOL];
  if (!entry) {
    return {
      configured: true,
      outdated: false,
      sourcePath: resolve(target, ".mise.toml"),
      environment: {
        location: "unknown",
        miseAvailable: false,
        signals: [],
      },
    };
  }

  return {
    configured: true,
    requested: entry.requested,
    current: entry.current,
    latest: entry.latest,
    outdated: Boolean(entry.current && entry.latest && entry.current !== entry.latest),
    sourcePath: entry.source?.path,
    environment: {
      location: "unknown",
      miseAvailable: false,
      signals: [],
    },
  };
}

export async function inspectProjectPiRuntime(target: string): Promise<ProjectPiRuntime> {
  const sourcePath = resolve(target, ".mise.toml");
  const environment = await inspectRuntimeEnvironment();
  if (!await hasProjectPiRuntimeTool(target)) {
    return { configured: false, outdated: false, sourcePath, environment };
  }

  const injected = process.env.PI_WORKSPACE_TEST_PI_RUNTIME_OUTDATED_JSON;
  if (injected !== undefined) {
    try {
      return { ...fromOutdatedJson(injected, target), environment };
    } catch (error) {
      return {
        configured: true,
        outdated: false,
        sourcePath,
        checkError: error instanceof Error ? error.message : String(error),
        environment,
      };
    }
  }

  if (!environment.miseAvailable) {
    return {
      configured: true,
      outdated: false,
      sourcePath,
      checkError: "mise is not available in the current execution environment",
      environment,
    };
  }

  try {
    const result = await $`mise outdated --local --json ${PI_RUNTIME_TOOL}`
      .cwd(target)
      .quiet()
      .nothrow();
    if (result.exitCode !== 0) {
      const message = result.stderr.toString().trim() || result.stdout.toString().trim();
      return {
        configured: true,
        outdated: false,
        sourcePath,
        checkError: message || "mise outdated failed",
        environment,
      };
    }
    return { ...fromOutdatedJson(result.stdout.toString(), target), environment };
  } catch (error) {
    return {
      configured: true,
      outdated: false,
      sourcePath,
      checkError: error instanceof Error ? error.message : String(error),
      environment,
    };
  }
}
