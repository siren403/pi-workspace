import { cleanWorkspaceFixture, driftedWorkspaceFixture, missingPackageFixture, newProjectFixture, staleManifestFixture } from "../fixtures/workspace.ts";
import { assertCleanWorkspace, assertDriftedWorkspace, assertMissingPackage, assertNewProject, assertPiRuntimeUpdateIntent, assertStaleManifestWorkspace, assertUpdateIntent } from "../assertions/smart.ts";
import { $ } from "bun";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SKILL_DIR = new URL("../../skills/pi-workspace/", import.meta.url).pathname;

async function status(target: string, intent: string, env: Record<string, string> = {}) {
  const result = await $`mise run status -- --target ${target} --intent ${intent} --json`
    .cwd(SKILL_DIR)
    .env({ ...process.env, ...env })
    .quiet();
  return JSON.parse(result.stdout.toString());
}

async function statusText(target: string, intent: string) {
  const result = await $`mise run status -- --target ${target} --intent ${intent}`.cwd(SKILL_DIR).quiet();
  return result.stdout.toString();
}

async function withFixture<T extends { cleanup(): Promise<void> }>(fixture: Promise<T>, fn: (fixture: T) => Promise<void>): Promise<void> {
  const resolved = await fixture;
  try {
    await fn(resolved);
  } finally {
    await resolved.cleanup();
  }
}

export async function runSmartWorkflowScenario(): Promise<void> {
  await withFixture(newProjectFixture(), async ({ target }) => {
    assertNewProject(await status(target, "처음 세팅"));
  });

  await withFixture(cleanWorkspaceFixture(), async ({ target }) => {
    assertCleanWorkspace(await status(target, "상태 확인"));
  });

  await withFixture(driftedWorkspaceFixture(), async ({ target }) => {
    assertDriftedWorkspace(await status(target, "작업 가능한 상태로 만들어줘"));
    assertUpdateIntent(await status(target, "재설치 후 최신 상태 확인"));
    const text = await statusText(target, "작업 가능한 상태로 만들어줘");
    if (!text.includes("[status] Deferred optional follow-ups")) {
      throw new Error("status text should label optional items as deferred");
    }
    if (!text.includes("Do not include deferred optional follow-ups in this approval request.")) {
      throw new Error("status text should exclude deferred optional follow-ups from approval");
    }
  });

  await withFixture(staleManifestFixture(), async ({ target }) => {
    assertStaleManifestWorkspace(await status(target, "작업 가능한 상태로 만들어줘"));
    await $`mise run update -- --target ${target} --force`.cwd(SKILL_DIR).quiet();
    const manifest = await Bun.file(`${target}/.agent-workspace.json`).json() as {
      manifestVersion?: number;
      template?: { revision?: string };
      managedFiles?: string[];
    };
    if (manifest.manifestVersion !== 1) throw new Error("stale manifest update: manifestVersion was not normalized");
    if (!manifest.template?.revision?.startsWith("sha256:")) throw new Error("stale manifest update: template revision missing");
    if (!manifest.managedFiles?.includes(".mise/tasks/pi:shell")) {
      throw new Error("stale manifest update: managedFiles missing current template file");
    }
  });

  await withFixture(missingPackageFixture(), async ({ target }) => {
    assertMissingPackage(await status(target, "상태 확인"));
  });

  await withFixture(cleanWorkspaceFixture(), async ({ target }) => {
    assertPiRuntimeUpdateIntent(await status(target, "pi update", {
      PI_WORKSPACE_TEST_PI_RUNTIME_OUTDATED_JSON: JSON.stringify({
        "npm:@earendil-works/pi-coding-agent": {
          requested: "latest",
          current: "0.74.0",
          latest: "0.75.1",
          source: { type: "mise.toml", path: `${target}/.mise.toml` },
        },
      }),
    }));
  });

  const noInstallRoot = await mkdtemp(join(tmpdir(), "pi-workspace-no-install-"));
  try {
    const target = join(noInstallRoot, "project");
    await mkdir(target, { recursive: true });
    const result = await $`mise run scaffold -- --target ${target} --no-install`.cwd(SKILL_DIR).quiet();
    const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
    if (output.includes("Installing required pi packages")) {
      throw new Error("scaffold --no-install should not attempt required pi package install");
    }
    if (!output.includes("Skipping tool/package install because --no-install was set.")) {
      throw new Error("scaffold --no-install should explain that installs were skipped");
    }
    if (await Bun.file(join(target, ".pi", "settings.json")).exists()) {
      throw new Error("scaffold --no-install should not create .pi/settings.json");
    }
  } finally {
    if (process.env.PI_WORKSPACE_E2E_KEEP_TEMP === "1") {
      console.log(`[e2e] keeping temp fixture: ${noInstallRoot}`);
    } else {
      await rm(noInstallRoot, { recursive: true, force: true });
    }
  }

  console.log("[e2e:smart] smart-workflow passed");
}
