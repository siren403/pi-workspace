#!/usr/bin/env bun
import { lstat, mkdir, readlink, realpath, rm, symlink } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const target = resolve("skills/pi-workspace");
const links = [
  ".pi/skills/pi-workspace",
  ".agents/skills/pi-workspace",
  ".claude/skills/pi-workspace",
];

async function ensureTarget(): Promise<void> {
  const stat = await lstat(target).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`Missing skill directory: ${target}`);
  }
}

async function linkOne(linkPath: string): Promise<void> {
  const existing = await lstat(linkPath).catch(() => null);
  if (existing) {
    if (!existing.isSymbolicLink()) {
      throw new Error(`${linkPath} exists and is not a symlink; refusing to overwrite`);
    }
    const actual = await realpath(linkPath).catch(() => null);
    if (actual === target) {
      console.log(`  ✓ ${linkPath} already linked`);
      return;
    }
    const raw = await readlink(linkPath).catch(() => "(unreadable)");
    console.log(`  · replacing ${linkPath} -> ${raw}`);
    await rm(linkPath, { force: true });
  }

  await mkdir(dirname(linkPath), { recursive: true });
  const relativeTarget = relative(dirname(linkPath), target) || ".";
  await symlink(relativeTarget, linkPath, "dir");
  console.log(`  ✓ ${linkPath} -> ${relativeTarget}`);
}

await ensureTarget();
console.log("[dogfood] linking pi-workspace skill\n");
for (const link of links) {
  await linkOne(link);
}
