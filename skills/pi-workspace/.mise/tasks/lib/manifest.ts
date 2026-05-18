import { resolve } from "path";
import { TEMPLATE_SOURCE } from "./templates.ts";

export const MANIFEST_FILE = ".agent-workspace.json";
export const MANIFEST_SCHEMA_VERSION = 1;

export interface Manifest {
  manifestVersion: number;
  profile: string;
  scaffoldedAt: string;
  template: {
    source: string;
    revision: string;
    appliedAt: string;
  };
  pi: {
    packages: string[];
    authMountMode: "ro" | "rw";
  };
  managedFiles: string[];
  legacyManagedFiles?: string[];
}

interface LegacyManifest {
  version?: unknown;
  manifestVersion?: unknown;
  profile?: unknown;
  scaffoldedAt?: unknown;
  template?: {
    source?: unknown;
    revision?: unknown;
    appliedAt?: unknown;
  };
  pi?: {
    packages?: unknown;
    authMountMode?: unknown;
  };
  managedFiles?: unknown;
  legacyManagedFiles?: unknown;
}

export function normalizeManagedFiles(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];
  const normalized: string[] = [];
  for (const path of paths) {
    if (typeof path !== "string") continue;
    const rel = path.replaceAll("\\", "/").replace(/^\.\//, "");
    if (!rel || rel.startsWith("/") || rel.split("/").includes("..")) continue;
    normalized.push(rel);
  }
  return [...new Set(normalized)].sort();
}

export function defaultManifest(options: {
  managedFiles: string[];
  templateRevision: string;
  scaffoldedAt?: string;
  appliedAt?: string;
}): Manifest {
  const now = new Date().toISOString();
  return {
    manifestVersion: MANIFEST_SCHEMA_VERSION,
    profile: "yolobox-pi-mise",
    scaffoldedAt: options.scaffoldedAt ?? now,
    template: {
      source: TEMPLATE_SOURCE,
      revision: options.templateRevision,
      appliedAt: options.appliedAt ?? now,
    },
    pi: {
      packages: ["npm:pi-subagents"],
      authMountMode: "ro",
    },
    managedFiles: normalizeManagedFiles(options.managedFiles),
  };
}

export function normalizeManifest(raw: LegacyManifest, options: {
  activeManagedFiles?: string[];
  templateRevision: string;
  appliedAt?: string;
}): Manifest {
  const active = normalizeManagedFiles(options.activeManagedFiles ?? raw.managedFiles);
  const previousManaged = normalizeManagedFiles(raw.managedFiles);
  const legacyManagedFiles = previousManaged.filter((path) => !active.includes(path));
  const now = new Date().toISOString();
  const pi = raw.pi ?? {};
  const template = raw.template ?? {};

  return {
    manifestVersion: MANIFEST_SCHEMA_VERSION,
    profile: typeof raw.profile === "string" ? raw.profile : "yolobox-pi-mise",
    scaffoldedAt: typeof raw.scaffoldedAt === "string" ? raw.scaffoldedAt : now,
    template: {
      source: typeof template.source === "string" ? template.source : TEMPLATE_SOURCE,
      revision: options.templateRevision,
      appliedAt: options.appliedAt ?? now,
    },
    pi: {
      packages: Array.isArray(pi.packages) && pi.packages.every((pkg) => typeof pkg === "string")
        ? pi.packages
        : ["npm:pi-subagents"],
      authMountMode: pi.authMountMode === "rw" ? "rw" : "ro",
    },
    managedFiles: active,
    ...(legacyManagedFiles.length > 0 ? { legacyManagedFiles } : {}),
  };
}

export async function readManifest(targetDir: string): Promise<Manifest | null> {
  const path = resolve(targetDir, MANIFEST_FILE);
  const f = Bun.file(path);
  if (!(await f.exists())) return null;
  try {
    const raw = await f.json() as LegacyManifest;
    return normalizeManifest(raw, {
      activeManagedFiles: normalizeManagedFiles(raw.managedFiles),
      templateRevision: typeof raw.template?.revision === "string" ? raw.template.revision : "unknown",
      appliedAt: typeof raw.template?.appliedAt === "string" ? raw.template.appliedAt : undefined,
    });
  } catch {
    return null;
  }
}

export async function writeManifest(targetDir: string, manifest: Manifest): Promise<void> {
  const path = resolve(targetDir, MANIFEST_FILE);
  await Bun.write(path, JSON.stringify(manifest, null, 2) + "\n");
}

export function isManagedFile(manifest: Manifest, relPath: string): boolean {
  return manifest.managedFiles.includes(relPath);
}
