#!/usr/bin/env bun
import { $ } from "bun";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const source = resolve("skills/pi-workspace");
const tempRoot = await mkdtemp(join(tmpdir(), "pi-workspace-install-check-"));
const target = join(tempRoot, "target");

try {
  await mkdir(join(tempRoot, "source", "skills"), { recursive: true });
  await mkdir(target, { recursive: true });
  await cp(source, join(tempRoot, "source", "skills", "pi-workspace"), { recursive: true });
  const skillPath = join(tempRoot, "source", "skills", "pi-workspace");

  console.log("[install-check] discovery with --full-depth");
  await $`npx skills add ${skillPath} --list --full-depth`.cwd(tempRoot);

  console.log("\n[install-check] discovery without --full-depth");
  await $`npx skills add ${skillPath} --list`.cwd(tempRoot);

  console.log("\n[install-check] install main skill for codex and pi in temp cwd");
  await $`npx skills add ${skillPath} --full-depth --skill pi-workspace --agent codex -y --copy`.cwd(target);
  await $`npx skills add ${skillPath} --full-depth --skill pi-workspace --agent pi -y --copy`.cwd(target);

  console.log("\n[install-check] ok");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
