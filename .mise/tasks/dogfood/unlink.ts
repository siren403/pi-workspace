#!/usr/bin/env bun
import { lstat, readlink, rm } from "node:fs/promises";

const links = [
  ".pi/skills/pi-workspace",
  ".agents/skills/pi-workspace",
  ".claude/skills/pi-workspace",
];

console.log("[dogfood] unlinking pi-workspace skill\n");
for (const link of links) {
  const stat = await lstat(link).catch(() => null);
  if (!stat) {
    console.log(`  · ${link} missing`);
    continue;
  }
  if (!stat.isSymbolicLink()) {
    console.log(`  ! ${link} exists and is not a symlink; skipped`);
    continue;
  }
  const raw = await readlink(link).catch(() => "(unreadable)");
  await rm(link, { force: true });
  console.log(`  ✓ removed ${link} -> ${raw}`);
}
