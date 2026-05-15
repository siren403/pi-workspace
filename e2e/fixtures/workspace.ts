import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const TEMPLATE_DIR = join(ROOT, "skills/pi-workspace/templates/scaffold");
const MANAGED_FILES = [
  ".yolobox.Dockerfile",
  "AGENTS.md",
  ".yolobox.toml",
  ".mise.toml",
  ".mise/tasks/pi:fork",
  ".mise/tasks/pi",
  ".mise/tasks/pi:shell",
  ".mise/tasks/pi:version",
  "CLAUDE.md",
  ".agent-workspace.json",
];

export interface Fixture {
  root: string;
  target: string;
  cleanup(): Promise<void>;
}

async function write(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, content);
}

async function createBaseTarget(root: string): Promise<string> {
  const target = join(root, "project");
  await mkdir(target, { recursive: true });

  await cp(TEMPLATE_DIR, target, { recursive: true });
  await write(join(target, "CLAUDE.md"), "@AGENTS.md\n");
  await write(join(target, ".gitignore"), ".pi/npm/\n.pi/git/\n.pi/agent/\n.claude/settings.local.json\n");
  await write(join(target, ".agent-workspace.json"), JSON.stringify({
    version: "0.1.0",
    profile: "yolobox-pi-mise",
    scaffoldedAt: "2026-01-01T00:00:00.000Z",
    pi: {
      packages: ["npm:pi-subagents"],
      authMountMode: "ro",
    },
    managedFiles: MANAGED_FILES,
  }, null, 2) + "\n");

  return target;
}

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "pi-workspace-e2e-"));
  const target = await createBaseTarget(root);
  return {
    root,
    target,
    cleanup: async () => {
      if (process.env.PI_WORKSPACE_E2E_KEEP_TEMP === "1") {
        console.log(`[e2e] keeping temp fixture: ${root}`);
        return;
      }
      await rm(root, { recursive: true, force: true });
    },
  };
}

export async function newProjectFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "pi-workspace-e2e-"));
  const target = join(root, "project");
  await mkdir(target, { recursive: true });
  return {
    root,
    target,
    cleanup: async () => {
      if (process.env.PI_WORKSPACE_E2E_KEEP_TEMP === "1") {
        console.log(`[e2e] keeping temp fixture: ${root}`);
        return;
      }
      await rm(root, { recursive: true, force: true });
    },
  };
}

export async function cleanWorkspaceFixture(): Promise<Fixture> {
  const fixture = await createFixture();
  await write(join(fixture.target, ".pi/settings.json"), JSON.stringify({
    packages: ["npm:pi-subagents"],
    subagents: {
      agentOverrides: {
        explore: { model: "provider/explore" },
        bulk: { model: "provider/bulk" },
        patch: { model: "provider/patch" },
        review: { model: "provider/review" },
      },
    },
  }, null, 2) + "\n");
  return fixture;
}

export async function driftedWorkspaceFixture(): Promise<Fixture> {
  const fixture = await cleanWorkspaceFixture();
  const dockerfile = await Bun.file(join(fixture.target, ".yolobox.Dockerfile")).text();
  await write(
    join(fixture.target, ".yolobox.Dockerfile"),
    dockerfile
      .replace("# PI_AUTORUN_CMD가 있으면 bash 시작 직후 해당 pi 명령을 exec\n", "")
      .replace("\nRUN echo", "RUN echo"),
  );
  return fixture;
}

export async function missingPackageFixture(): Promise<Fixture> {
  const fixture = await createFixture();
  await write(join(fixture.target, ".pi/settings.json"), JSON.stringify({ packages: [] }, null, 2) + "\n");
  return fixture;
}
