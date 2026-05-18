import { cleanWorkspaceFixture, driftedWorkspaceFixture, missingPackageFixture, newProjectFixture } from "../fixtures/workspace.ts";
import { assertCleanWorkspace, assertDriftedWorkspace, assertMissingPackage, assertNewProject, assertUpdateIntent } from "../assertions/smart.ts";
import { $ } from "bun";

const SKILL_DIR = new URL("../../skills/pi-workspace/", import.meta.url).pathname;

async function status(target: string, intent: string) {
  const result = await $`mise run status -- --target ${target} --intent ${intent} --json`.cwd(SKILL_DIR).quiet();
  return JSON.parse(result.stdout.toString());
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
  });

  await withFixture(missingPackageFixture(), async ({ target }) => {
    assertMissingPackage(await status(target, "상태 확인"));
  });

  console.log("[e2e:smart] smart-workflow passed");
}
