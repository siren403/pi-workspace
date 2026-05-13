import { resolve } from "path";

export const MANIFEST_FILE = ".agent-workspace.json";
export const MANIFEST_VERSION = "0.1.0";

export interface Manifest {
  version: string;
  profile: string;
  scaffoldedAt: string;
  pi: {
    packages: string[];
    authMountMode: "ro" | "rw";
  };
  managedFiles: string[];
}

export function defaultManifest(): Manifest {
  return {
    version: MANIFEST_VERSION,
    profile: "yolobox-pi-mise",
    scaffoldedAt: new Date().toISOString(),
    pi: {
      packages: ["npm:pi-subagents"],
      authMountMode: "ro",
    },
    managedFiles: [
      ".agent-workspace.json",
      ".yolobox.toml",
      ".yolobox.Dockerfile",
      ".mise.toml",
      "AGENTS.md",
      ".mise/tasks/agent.ts",
      ".mise/tasks/agent-fork.ts",
      ".mise/tasks/agent-rw.ts",
      ".pi/settings.json",
      ".pi/prompts/review.md",
      ".pi/prompts/plan.md",
      ".pi/prompts/implement.md",
      ".pi/prompts/fix-test.md",
      ".pi/prompts/pr.md",
      ".pi/skills/safe-edit/SKILL.md",
      ".pi/extensions/sandbox-policy.ts",
      ".pi/agents/explore.md",
      ".pi/agents/bulk.md",
      ".pi/agents/patch.md",
      ".pi/agents/review.md",
    ],
  };
}

export async function readManifest(targetDir: string): Promise<Manifest | null> {
  const path = resolve(targetDir, MANIFEST_FILE);
  const f = Bun.file(path);
  if (!(await f.exists())) return null;
  return f.json() as Promise<Manifest>;
}

export async function writeManifest(targetDir: string, manifest: Manifest): Promise<void> {
  const path = resolve(targetDir, MANIFEST_FILE);
  await Bun.write(path, JSON.stringify(manifest, null, 2) + "\n");
}

export function isManagedFile(manifest: Manifest, relPath: string): boolean {
  return manifest.managedFiles.includes(relPath);
}
