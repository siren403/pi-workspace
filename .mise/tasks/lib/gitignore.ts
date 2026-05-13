import { resolve } from "path";

const PI_PATTERNS = `
# pi workspace
.pi/npm/
.pi/git/
.pi/agent/
.claude/settings.local.json
`.trimStart();

export async function injectGitignore(targetDir: string): Promise<"injected" | "skipped"> {
  const path = resolve(targetDir, ".gitignore");
  const file = Bun.file(path);
  const existing = (await file.exists()) ? await file.text() : "";

  const missing = PI_PATTERNS.split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .filter((pattern) => !existing.includes(pattern));

  if (missing.length === 0) return "skipped";

  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await Bun.write(path, existing + separator + PI_PATTERNS);
  return "injected";
}
