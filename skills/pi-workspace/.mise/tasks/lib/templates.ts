import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

export const TEMPLATE_DIR = resolve(import.meta.dir, "../../../templates/scaffold");
export const TEMPLATE_SOURCE = "siren403/pi-workspace/templates/scaffold";

export async function listTemplateFiles(): Promise<string[]> {
  const entries = await readdir(TEMPLATE_DIR, { withFileTypes: true, recursive: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const parent = entry.parentPath ?? TEMPLATE_DIR;
    paths.push(relative(TEMPLATE_DIR, resolve(parent, entry.name)));
  }
  return paths.sort();
}

export async function getTemplateFiles(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const rel of await listTemplateFiles()) {
    map.set(rel, join(TEMPLATE_DIR, rel));
  }
  return map;
}

export async function templateRevision(): Promise<string> {
  const hash = createHash("sha256");
  for (const rel of await listTemplateFiles()) {
    hash.update(rel);
    hash.update("\0");
    hash.update(Buffer.from(await Bun.file(join(TEMPLATE_DIR, rel)).arrayBuffer()));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}
