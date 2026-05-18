import { resolve, relative, join } from "path";
import { readdir } from "fs/promises";
import { readManifest, writeManifest, MANIFEST_FILE } from "./manifest.ts";
import { writeFile, diffFile } from "./fs.ts";

const TEMPLATES_DIR = resolve(import.meta.dir, "../../../templates/scaffold");

// 코드 생성 파일 (템플릿 없음 → 업데이트 대상 제외)
const CODE_GENERATED = [MANIFEST_FILE];

async function getTemplateFiles(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    const full = join(e.parentPath ?? TEMPLATES_DIR, e.name);
    const rel  = relative(TEMPLATES_DIR, full);
    map.set(rel, full);
  }
  return map;
}

export async function runUpdate(opts: { target: string; force: boolean; diff: boolean }): Promise<void> {
  const target = resolve(opts.target);
  const manifest = await readManifest(target);

  if (!manifest) {
    console.error("[update] .agent-workspace.json not found. Run /pi-workspace:scaffold first.");
    process.exit(1);
  }

  console.log("\n[update] Checking managed files...\n");

  const templates = await getTemplateFiles();
  let updated = 0, skipped = 0, conflict = 0;
  const candidates = [...new Set([...manifest.managedFiles, ...templates.keys()])].sort();

  for (const rel of candidates) {
    if (CODE_GENERATED.includes(rel)) continue;  // 코드 생성 파일 제외

    const tmplPath = templates.get(rel);
    if (!tmplPath) {
      console.log(`  · ${rel}  (no template — skipped)`);
      skipped++;
      continue;
    }

    const newContent = await Bun.file(tmplPath).text();
    const destPath   = resolve(target, rel);

    if (opts.diff) {
      await diffFile(destPath, newContent);
      continue;
    }

    const result = await writeFile(destPath, newContent, { force: opts.force, managed: true });

    const icons = { created: "✓", updated: "✓", skipped: "·", conflict: "⚠" };
    console.log(`  ${icons[result]} ${rel}  (${result})`);

    if (result === "updated") updated++;
    else if (result === "conflict") conflict++;
    else skipped++;
  }

  if (!opts.diff) {
    if (conflict === 0) {
      const managedFiles = [...new Set([...manifest.managedFiles, ...templates.keys()])].sort();
      const changed = managedFiles.join("\n") !== [...manifest.managedFiles].sort().join("\n");
      if (changed) {
        await writeManifest(target, { ...manifest, managedFiles });
        console.log("  ✓ .agent-workspace.json  (managedFiles updated)");
        updated++;
      }
    }
    console.log(`\n  updated: ${updated}  skipped: ${skipped}  conflicts: ${conflict}`);
    if (conflict > 0)
      console.warn("  Use --force to overwrite conflicting files.");
  }
}
