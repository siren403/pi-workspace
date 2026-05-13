import { resolve, relative, dirname, join } from "path";
import { readdir, chmod } from "fs/promises";
import { $ } from "bun";
import { writeFile, diffFile } from "./fs.ts";
import { writeManifest, defaultManifest, type Manifest } from "./manifest.ts";
import { injectGitignore } from "./gitignore.ts";

const TEMPLATES_DIR = resolve(import.meta.dir, "../../../templates/scaffold");
const EXECUTABLE_TASKS = ["pi", "pi:fork", "pi:shell"];

export interface ScaffoldOptions {
  target: string;
  force: boolean;
  check: boolean;
  diff: boolean;
  install: boolean;
}

interface FileAction {
  relPath: string;
  result: "created" | "skipped" | "conflict" | "updated" | "would-create" | "would-update";
}

async function walkDir(dir: string): Promise<string[]> {
  const paths: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    if (e.isFile()) {
      const full = join(e.parentPath ?? dirname(join(dir, e.name)), e.name);
      paths.push(full);
    }
  }
  return paths;
}

export async function runScaffold(opts: ScaffoldOptions): Promise<void> {
  const target = resolve(opts.target);
  const actions: FileAction[] = [];

  console.log(`\n[scaffold] target: ${target}\n`);

  // 1. 템플릿 파일 복사
  const templateFiles = await walkDir(TEMPLATES_DIR);

  for (const srcPath of templateFiles) {
    const relPath = relative(TEMPLATES_DIR, srcPath);
    const destPath = resolve(target, relPath);
    const content = await Bun.file(srcPath).text();

    if (opts.diff) {
      await diffFile(destPath, content);
      continue;
    }

    if (opts.check) {
      const exists = await Bun.file(destPath).exists();
      actions.push({ relPath, result: exists ? "would-update" : "would-create" });
      continue;
    }

    const result = await writeFile(destPath, content, {
      force: opts.force,
      managed: true,
    });
    actions.push({ relPath, result });
  }

  if (opts.diff || opts.check) {
    printActions(actions, opts.check);
    return;
  }

  // 2. task 파일 실행 권한
  for (const name of EXECUTABLE_TASKS) {
    const taskPath = resolve(target, ".mise", "tasks", name);
    if (await Bun.file(taskPath).exists()) {
      await chmod(taskPath, 0o755);
    }
  }

  // 3. .gitignore pi 패턴 주입
  const giResult = await injectGitignore(target);
  console.log(`  ${giResult === "injected" ? "✓" : "·"} .gitignore pi patterns ${giResult}`);

  // 4. manifest 생성
  const managedFiles = templateFiles.map((f) => relative(TEMPLATES_DIR, f));
  managedFiles.push(".agent-workspace.json");

  const manifest: Manifest = {
    ...defaultManifest(),
    scaffoldedAt: new Date().toISOString(),
    managedFiles,
  };
  await writeManifest(target, manifest);
  console.log("  ✓ .agent-workspace.json");

  // 5. pi install npm:pi-subagents -l
  console.log("\n[scaffold] Installing required pi packages...\n");
  const piResult = await $`pi install npm:pi-subagents -l`
    .cwd(target)
    .quiet()
    .nothrow();

  if (piResult.exitCode === 0) {
    console.log("  ✓ npm:pi-subagents installed (project scope)");
  } else {
    console.warn("  ⚠ pi install failed:", piResult.stderr.toString().trim());
    console.warn("    Run manually: pi install npm:pi-subagents -l");
  }

  // 6. --install 플래그: mise install + lock
  if (opts.install) {
    console.log("\n[scaffold] Running mise install...");
    await $`mise install`.cwd(target).nothrow();
    await $`mise lock`.cwd(target).nothrow();
  }

  // 7. 결과 출력
  printActions(actions, false);
  printNextSteps();
}

function printActions(actions: FileAction[], checkMode: boolean): void {
  const icons: Record<string, string> = {
    created: "✓", updated: "✓", skipped: "·",
    conflict: "⚠", "would-create": "→", "would-update": "~",
  };
  console.log(checkMode ? "\n[scaffold] --check: no changes made\n" : "\n[scaffold] Files\n");
  for (const { relPath, result } of actions) {
    console.log(`  ${icons[result] ?? "?"} ${relPath}  (${result})`);
  }
  const conflicts = actions.filter((a) => a.result === "conflict");
  if (conflicts.length) {
    console.warn(`\n  ⚠ ${conflicts.length} conflict(s). Use --force to overwrite.`);
  }
}

function printNextSteps(): void {
  console.log(`
[scaffold] Done.

Next steps:

  1. pi 확장 설치 (선택):
       /pi-workspace:extensions

  2. 프로바이더 로그인 후 서브에이전트 구성:
       pi /login
       pi install npm:pi-subagents -l
       /pi-workspace:subagents

  3. 에이전트 실행:
       mise run pi
`);
}
