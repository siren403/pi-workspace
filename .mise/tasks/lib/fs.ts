import { resolve, dirname } from "path";
import { mkdir } from "fs/promises";

export type WriteResult = "created" | "skipped" | "conflict" | "updated";

export interface WriteOptions {
  force?: boolean;
  managed?: boolean; // manifest의 managedFile이면 update 모드에서 갱신 가능
}

/**
 * 파일 쓰기.
 * - 없으면 생성 → "created"
 * - 있고 force → 덮어쓰기 → "updated"
 * - 있고 managed + force → "updated"
 * - 있고 force 없음 → "skipped" (managed 아님) or "conflict" (managed인데 내용 다름)
 */
export async function writeFile(
  path: string,
  content: string,
  opts: WriteOptions = {}
): Promise<WriteResult> {
  const abs = resolve(path);
  const file = Bun.file(abs);

  if (!(await file.exists())) {
    await mkdir(dirname(abs), { recursive: true });
    await Bun.write(abs, content);
    return "created";
  }

  if (opts.force) {
    await Bun.write(abs, content);
    return "updated";
  }

  const existing = await file.text();
  if (opts.managed && existing !== content) return "conflict";
  return "skipped";
}

/** diff 출력 (--diff 모드용). */
export async function diffFile(path: string, newContent: string): Promise<void> {
  const abs = resolve(path);
  const existing = await Bun.file(abs).exists()
    ? await Bun.file(abs).text()
    : "";

  if (existing === newContent) {
    console.log(`  (no change) ${path}`);
    return;
  }

  const oldLines = existing.split("\n");
  const newLines = newContent.split("\n");
  console.log(`\n--- ${path}`);
  console.log(`+++ ${path} (proposed)`);
  // 단순 라인 비교 출력 (외부 diff 없이)
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const o = oldLines[i] ?? "";
    const n = newLines[i] ?? "";
    if (o !== n) {
      if (o) console.log(`- ${o}`);
      if (n) console.log(`+ ${n}`);
    }
  }
}
