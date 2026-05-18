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

async function projectPiVersion(target: string): Promise<string | null> {
  const lockPath = resolve(target, "mise.lock");
  try {
    const text = await Bun.file(lockPath).text();
    const section = text.match(/\[\[tools\."npm:@earendil-works\/pi-coding-agent"\]\][\s\S]*?(?=\n\[\[|$)/);
    const version = section?.[0].match(/^version = "([^"]+)"/m)?.[1];
    return version ?? null;
  } catch {
    return null;
  }
}

export async function expectedTemplateContent(target: string, relPath: string): Promise<string> {
  const content = await Bun.file(join(TEMPLATE_DIR, relPath)).text();
  if (relPath !== ".yolobox.Dockerfile") return content;

  const version = await projectPiVersion(target);
  if (!version) return content;
  return content.replace(
    /@earendil-works\/pi-coding-agent@[^ \n]+/,
    `@earendil-works/pi-coding-agent@${version}`,
  );
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
