import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const SKILL_DIR = new URL("../../skills/pi-workspace/", import.meta.url).pathname;

export async function runColdStartScenario(): Promise<void> {
  const sandbox = await mkdtemp(join(tmpdir(), "pi-workspace-cold-start-"));
  try {
    const mise = (await $`which mise`.text()).trim();
    const result = await $`${mise} run status -- --target ${SKILL_DIR} --intent cold-start`
      .cwd(SKILL_DIR)
      .env({
        ...process.env,
        PATH: "/usr/bin:/bin",
        MISE_DATA_DIR: join(sandbox, "mise-data"),
        MISE_CACHE_DIR: join(sandbox, "mise-cache"),
        MISE_AUTO_INSTALL: "0",
        MISE_TRUSTED_CONFIG_PATHS: join(SKILL_DIR, ".mise.toml"),
      })
      .quiet()
      .nothrow();

    const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
    if (result.exitCode === 0) throw new Error("cold-start status unexpectedly succeeded without bun");
    if (!output.includes("bun is required")) {
      throw new Error(`cold-start status did not print bootstrap guidance:\n${output}`);
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }

  console.log("[e2e:cold-start] bootstrap guidance passed");
}
