import { resolve } from "node:path";
import { $ } from "bun";

export const PI_RUNTIME_TOOL = "npm:@earendil-works/pi-coding-agent";

export interface ProjectPiRuntime {
  configured: boolean;
  requested?: string;
  current?: string;
  latest?: string;
  outdated: boolean;
  sourcePath?: string;
  checkError?: string;
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

function fromOutdatedJson(jsonText: string, target: string): ProjectPiRuntime {
  const parsed = JSON.parse(jsonText || "{}") as Record<string, MiseOutdatedEntry>;
  const entry = parsed[PI_RUNTIME_TOOL];
  if (!entry) {
    return {
      configured: true,
      outdated: false,
      sourcePath: resolve(target, ".mise.toml"),
    };
  }

  return {
    configured: true,
    requested: entry.requested,
    current: entry.current,
    latest: entry.latest,
    outdated: Boolean(entry.current && entry.latest && entry.current !== entry.latest),
    sourcePath: entry.source?.path,
  };
}

export async function inspectProjectPiRuntime(target: string): Promise<ProjectPiRuntime> {
  const sourcePath = resolve(target, ".mise.toml");
  if (!await hasProjectPiRuntimeTool(target)) {
    return { configured: false, outdated: false, sourcePath };
  }

  const injected = process.env.PI_WORKSPACE_TEST_PI_RUNTIME_OUTDATED_JSON;
  if (injected !== undefined) {
    try {
      return fromOutdatedJson(injected, target);
    } catch (error) {
      return {
        configured: true,
        outdated: false,
        sourcePath,
        checkError: error instanceof Error ? error.message : String(error),
      };
    }
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
      };
    }
    return fromOutdatedJson(result.stdout.toString(), target);
  } catch (error) {
    return {
      configured: true,
      outdated: false,
      sourcePath,
      checkError: error instanceof Error ? error.message : String(error),
    };
  }
}
