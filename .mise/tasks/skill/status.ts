#!/usr/bin/env bun
import { $ } from "bun";
import { resolve } from "node:path";

const skillDir = new URL("../../../skills/pi-workspace/", import.meta.url).pathname;
const args = Bun.argv.slice(2);
const callerCwd = process.cwd();

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--target" && args[i + 1] && !args[i + 1].startsWith("-")) {
    args[i + 1] = resolve(callerCwd, args[i + 1]);
    i += 1;
  } else if (args[i].startsWith("--target=")) {
    args[i] = `--target=${resolve(callerCwd, args[i].slice("--target=".length))}`;
  }
}

await $`mise trust --yes`.cwd(skillDir).quiet();
await $`mise run status -- ${args}`.cwd(skillDir);
