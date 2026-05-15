#!/usr/bin/env bun
import { $ } from "bun";
import { resolve } from "node:path";

const skillDir = resolve("skills/pi-workspace");
const args = Bun.argv.slice(2);

await $`mise trust --yes`.cwd(skillDir).quiet();
await $`mise run verify -- ${args}`.cwd(skillDir);
