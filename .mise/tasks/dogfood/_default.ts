#!/usr/bin/env bun
import { lstat, readlink, realpath } from "node:fs/promises";
import { resolve } from "node:path";

const links = [
  ".pi/skills/pi-workspace",
  ".agents/skills/pi-workspace",
  ".claude/skills/pi-workspace",
];

const target = resolve("skills/pi-workspace");

console.log("[dogfood] pi-workspace local links\n");
for (const link of links) {
  try {
    const stat = await lstat(link);
    if (!stat.isSymbolicLink()) {
      console.log(`  ! ${link} exists but is not a symlink`);
      continue;
    }
    const raw = await readlink(link);
    const actual = await realpath(link).catch(() => null);
    const ok = actual === target;
    console.log(`  ${ok ? "✓" : "!"} ${link} -> ${raw}`);
  } catch {
    console.log(`  · ${link} missing`);
  }
}

console.log("\nUse: mise run dogfood:link | mise run dogfood:unlink");
