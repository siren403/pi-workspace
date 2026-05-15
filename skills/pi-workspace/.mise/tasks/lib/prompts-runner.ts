import { resolve, dirname } from "path";
import { mkdir } from "fs/promises";
import {
  CATALOG,
  findBySlug,
  isRepoRef,
  slugFromRepo,
  type PromptSource,
} from "./prompts-catalog.ts";

const GH_RAW = "https://raw.githubusercontent.com";

// ─── GitHub fetch ─────────────────────────────────────────────────────────────

async function fetchRaw(repo: string, path: string): Promise<string | null> {
  const url = `${GH_RAW}/${repo}/HEAD/${path}`;
  const res = await fetch(url, {
    headers: process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {},
  });
  if (!res.ok) return null;
  return res.text();
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;
  return content.slice(end + 4).trimStart();
}

async function fetchSource(source: PromptSource): Promise<string> {
  const raw = await fetchRaw(source.repo, source.contentPath);
  if (raw === null)
    throw new Error(`Cannot fetch ${source.repo}/${source.contentPath}`);
  return source.stripFrontmatter ? stripFrontmatter(raw) : raw;
}

/** owner/repo 레퍼런스에서 콘텐츠 자동 탐색:
 *  SKILL.md body → CLAUDE.md → README.md */
async function fetchFromRepo(repo: string): Promise<{ content: string; slug: string }> {
  const slug = slugFromRepo(repo);

  // 1. SKILL.md (skills.sh 형식) — body만 추출
  const skill = await fetchRaw(repo, "SKILL.md");
  if (skill) {
    return { content: stripFrontmatter(skill), slug };
  }

  // 2. CLAUDE.md
  const claude = await fetchRaw(repo, "CLAUDE.md");
  if (claude) return { content: claude, slug };

  // 3. README.md
  const readme = await fetchRaw(repo, "README.md");
  if (readme) return { content: readme, slug };

  throw new Error(`No usable content found in ${repo} (tried SKILL.md, CLAUDE.md, README.md)`);
}

// ─── AGENTS.md 섹션 마커 관리 ──────────────────────────────────────────────

const MARKER_START = (slug: string) => `<!-- pi-prompts:${slug}:start -->`;
const MARKER_END   = (slug: string) => `<!-- pi-prompts:${slug}:end -->`;

function wrapSection(slug: string, content: string): string {
  return `${MARKER_START(slug)}\n${content.trimEnd()}\n${MARKER_END(slug)}`;
}

function upsertSection(existing: string, slug: string, content: string): string {
  const start = MARKER_START(slug);
  const end = MARKER_END(slug);
  const block = wrapSection(slug, content);

  const si = existing.indexOf(start);
  const ei = existing.indexOf(end);

  if (si !== -1 && ei !== -1 && ei > si) {
    // 교체
    return existing.slice(0, si) + block + existing.slice(ei + end.length);
  }

  // 없으면 끝에 추가 (빈 줄 구분)
  const trimmed = existing.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

async function readAgentsMd(targetDir: string): Promise<string> {
  const path = resolve(targetDir, "AGENTS.md");
  const f = Bun.file(path);
  return (await f.exists()) ? f.text() : "";
}

async function writeAgentsMd(targetDir: string, content: string): Promise<void> {
  const path = resolve(targetDir, "AGENTS.md");
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, content);
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

export function printCatalog(): void {
  console.log("\n[prompts] Catalog\n");
  const w = Math.max(...CATALOG.map((s) => s.slug.length));
  for (const s of CATALOG) {
    console.log(`  ${s.slug.padEnd(w)}  ${s.repo.padEnd(44)}  ${s.description}`);
  }
  console.log(`
Usage:
  mise run prompts -- --preview karpathy
  mise run prompts -- --target <path> --install karpathy
  mise run prompts -- --target <path> --install karpathy,<owner/repo>
  echo "<synthesized>" | mise run prompts -- --target <path> --write --section my-rules
`);
}

export async function previewSource(ref: string): Promise<void> {
  let content: string;
  let label: string;

  if (isRepoRef(ref)) {
    const r = await fetchFromRepo(ref);
    content = r.content;
    label = ref;
  } else {
    const src = findBySlug(ref);
    if (!src) throw new Error(`Unknown slug "${ref}". Use --list to see catalog.`);
    content = await fetchSource(src);
    label = `${src.name} (${src.repo})`;
  }

  console.log(`\n── ${label} ─────────────────────────────────────\n`);
  console.log(content);
  console.log("────────────────────────────────────────────────────\n");
}

export async function installSources(
  refs: string[],
  targetDir: string,
  force: boolean,
): Promise<void> {
  let agentsMd = await readAgentsMd(targetDir);
  const targetPath = resolve(targetDir, "AGENTS.md");
  const exists = await Bun.file(targetPath).exists();

  console.log(`\n[prompts] Installing into ${targetPath}\n`);

  for (const ref of refs) {
    let slug: string;
    let content: string;

    if (isRepoRef(ref)) {
      const r = await fetchFromRepo(ref);
      slug = r.slug;
      content = r.content;
    } else {
      const src = findBySlug(ref);
      if (!src) {
        console.warn(`  ⚠ Unknown slug "${ref}" — skipped`);
        continue;
      }
      slug = src.slug;
      content = await fetchSource(src);
    }

    const alreadyPresent = agentsMd.includes(MARKER_START(slug));
    if (alreadyPresent && !force) {
      console.log(`  · ${slug}  (already installed — use --force to overwrite)`);
      continue;
    }

    agentsMd = upsertSection(agentsMd, slug, content);
    console.log(`  ✓ ${slug}  (${alreadyPresent ? "updated" : "added"})`);
  }

  if (!exists && !agentsMd.trim()) {
    console.log("  · nothing to write");
    return;
  }

  await writeAgentsMd(targetDir, agentsMd);
  console.log(`\n  → AGENTS.md written`);
}

/** 에이전트가 프로젝트 컨텍스트를 수집할 수 있도록 구조화된 정보 출력 */
export async function printContext(targetDir: string): Promise<void> {
  const abs = resolve(targetDir);
  console.log("\n[prompts:context]\n");

  // 1. 현재 AGENTS.md
  const agentsMd = await readAgentsMd(abs);
  if (agentsMd.trim()) {
    console.log("## Current AGENTS.md\n");
    console.log(agentsMd.trim());
    console.log();
  } else {
    console.log("## Current AGENTS.md\n(none)\n");
  }

  // 2. 설치된 섹션 마커 목록
  const installed = CATALOG
    .filter((s) => agentsMd.includes(MARKER_START(s.slug)))
    .map((s) => s.slug);
  console.log(`## Installed prompt sections\n${installed.length ? installed.map((s) => `- ${s}`).join("\n") : "(none)"}\n`);

  // 3. pi settings
  const piSettings = Bun.file(resolve(abs, ".pi", "settings.json"));
  if (await piSettings.exists()) {
    const s = await piSettings.json() as Record<string, unknown>;
    const keys = ["defaultProvider", "defaultModel", "packages", "subagents"];
    const subset = Object.fromEntries(keys.filter((k) => k in s).map((k) => [k, s[k]]));
    console.log("## .pi/settings.json (relevant fields)\n");
    console.log(JSON.stringify(subset, null, 2));
    console.log();
  }

  // 4. package.json 또는 .mise.toml (기술 스택 힌트)
  const pkgJson = Bun.file(resolve(abs, "package.json"));
  if (await pkgJson.exists()) {
    const p = await pkgJson.json() as Record<string, unknown>;
    const { name, description, dependencies, devDependencies } = p as Record<string, unknown>;
    console.log("## package.json (summary)\n");
    console.log(JSON.stringify({ name, description, dependencies, devDependencies }, null, 2));
    console.log();
  }

  const miseCfg = Bun.file(resolve(abs, ".mise.toml"));
  if (await miseCfg.exists()) {
    console.log("## .mise.toml\n");
    console.log(await miseCfg.text());
    console.log();
  }

  // 5. 카탈로그
  console.log("## Available prompt catalog\n");
  for (const s of CATALOG) {
    console.log(`- ${s.slug}: ${s.description}  (${s.repo})`);
  }
  console.log();
  console.log("---");
  console.log("Use the above to synthesize a tailored AGENTS.md section for this project.");
  console.log("Write result via: echo '<content>' | mise run prompts -- --target <path> --write --section <name>");
}

/** 에이전트가 stdin으로 합성한 내용을 섹션 마커로 AGENTS.md에 기록 */
export async function writeSection(
  targetDir: string,
  section: string,
  content: string,
): Promise<void> {
  let agentsMd = await readAgentsMd(targetDir);
  agentsMd = upsertSection(agentsMd, section, content);
  await writeAgentsMd(targetDir, agentsMd);
  console.log(`  ✓ AGENTS.md — section "${section}" written`);
}

// ─── options 타입 ─────────────────────────────────────────────────────────────

export interface PromptsOptions {
  target: string;
  list: boolean;
  context: boolean;
  preview?: string;
  install?: string;
  write: boolean;
  section?: string;
  force: boolean;
  source?: string;
}

export async function runPrompts(opts: PromptsOptions): Promise<void> {
  if (opts.context) {
    await printContext(resolve(opts.target));
    return;
  }

  if (opts.list || (!opts.preview && !opts.install && !opts.write && !opts.source)) {
    printCatalog();
    return;
  }

  if (opts.preview) {
    await previewSource(opts.preview);
    return;
  }

  // --source: 카탈로그 외 레포 단독 preview 또는 install
  if (opts.source && !opts.install) {
    await previewSource(opts.source);
    return;
  }

  if (opts.install) {
    const refs = [
      ...(opts.install.split(",").map((s) => s.trim()).filter(Boolean)),
      ...(opts.source ? [opts.source] : []),
    ];
    await installSources(refs, resolve(opts.target), opts.force);
    return;
  }

  if (opts.write) {
    if (!opts.section) {
      console.error("[prompts] --write requires --section <name>");
      process.exit(1);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString("utf8");
    if (!content.trim()) {
      console.error("[prompts] --write: no content received on stdin");
      process.exit(1);
    }
    await writeSection(resolve(opts.target), opts.section!, content);
    return;
  }
}
