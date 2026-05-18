import { resolve, join } from "path";
import { chmod, stat } from "fs/promises";
import { $ } from "bun";
import { writeFile, diffFile } from "./fs.ts";
import { writeManifest, defaultManifest, type Manifest } from "./manifest.ts";
import { injectGitignore } from "./gitignore.ts";
import { getTemplateFiles, templateRevision } from "./templates.ts";

const EXECUTABLE_TASKS = ["pi", "pi:fork", "pi:shell", "pi:version"];

const AGENT_FILES: Record<string, { path: string; content: string }> = {
  claude: { path: "CLAUDE.md", content: "@AGENTS.md\n" },
};

async function detectAgents(target: string): Promise<string[]> {
  const agents: string[] = [];
  const claudeBin = await $`which claude`.quiet().nothrow();
  const claudeDir = await stat(join(target, ".claude")).then(s => s.isDirectory()).catch(() => false);
  if (claudeBin.exitCode === 0 || claudeDir) agents.push("claude");
  return agents;
}

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

export async function runScaffold(opts: ScaffoldOptions): Promise<void> {
  const target = resolve(opts.target);
  const actions: FileAction[] = [];

  console.log(`\n[scaffold] target: ${target}\n`);

  // 1. 템플릿 파일 복사
  const templateFiles = await getTemplateFiles();

  for (const [relPath, srcPath] of templateFiles) {
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

  // 2. 에이전트 감지 후 전용 설정 파일 생성
  const agents = await detectAgents(target);
  for (const agent of agents) {
    const { path: relPath, content } = AGENT_FILES[agent];
    const destPath = resolve(target, relPath);

    if (opts.diff) {
      await diffFile(destPath, content);
      continue;
    }
    if (opts.check) {
      const exists = await Bun.file(destPath).exists();
      actions.push({ relPath, result: exists ? "would-update" : "would-create" });
      continue;
    }
    const result = await writeFile(destPath, content, { force: opts.force, managed: true });
    actions.push({ relPath, result });
  }

  if (opts.diff) return;
  if (opts.check) {
    printActions(actions, true);
    return;
  }

  // 3. task 파일 실행 권한
  for (const name of EXECUTABLE_TASKS) {
    const taskPath = resolve(target, ".mise", "tasks", name);
    if (await Bun.file(taskPath).exists()) {
      await chmod(taskPath, 0o755);
    }
  }

  // 4. .gitignore pi 패턴 주입
  const giResult = await injectGitignore(target);
  console.log(`  ${giResult === "injected" ? "✓" : "·"} .gitignore pi patterns ${giResult}`);

  // 5. manifest 생성
  const managedFiles = [...templateFiles.keys()];
  managedFiles.push(...agents.map((a) => AGENT_FILES[a].path));

  const manifest: Manifest = defaultManifest({
    managedFiles,
    templateRevision: await templateRevision(),
  });
  await writeManifest(target, manifest);
  console.log("  ✓ .agent-workspace.json");

  // 6. --install 플래그: mise trust + install + lock + required pi packages
  if (opts.install) {
    console.log("\n[scaffold] Running mise install...");
    const trustResult = await $`mise trust --yes`.cwd(target).quiet().nothrow();
    if (trustResult.exitCode !== 0) {
      console.warn("  ⚠ mise trust failed — run manually: mise trust --yes");
      console.warn(`    ${trustResult.stderr.toString().trim()}`);
      printActions(actions, false);
      printNextSteps();
      return;
    }
    const installResult = await $`mise install`.cwd(target).nothrow();
    if (installResult.exitCode === 0) {
      console.log("  ✓ mise install complete (node + pi)");
      await $`mise lock`.cwd(target).quiet().nothrow();
    } else {
      console.warn("  ⚠ mise install failed — run manually: mise install");
    }

    console.log("\n[scaffold] Installing required pi packages...\n");
    const piResult = await $`mise exec -- pi install npm:pi-subagents -l`
      .cwd(target)
      .quiet()
      .nothrow();

    if (piResult.exitCode === 0) {
      console.log("  ✓ npm:pi-subagents installed (project scope)");
    } else {
      console.warn("  ⚠ pi install failed:", piResult.stderr.toString().trim());
      console.warn("    Run manually from target: mise trust --yes && mise exec -- pi install npm:pi-subagents -l");
    }
  } else {
    console.log("\n[scaffold] Skipping tool/package install because --no-install was set.");
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
