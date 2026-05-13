import { resolve, join, dirname } from "path";
import { homedir } from "os";
import { mkdir } from "fs/promises";
import { $ } from "bun";
import { listModels, getProviders, parseContext, type Model } from "./models.ts";

const TEMPLATES_DIR = resolve(import.meta.dir, "../../../templates/subagents/.pi/agents");

// ─── 역할 정의 ───────────────────────────────────────────────────────────────

export const ROLES = ["explore", "bulk", "patch", "review"] as const;
export type Role = (typeof ROLES)[number];

interface RoleMeta {
  requireThinking: boolean;   // thinking 모델 필수
  premiumProvider: boolean;   // 고품질 프로바이더 우선 (openai-codex 등)
  largeContext: boolean;      // 컨텍스트 클수록 유리
  thinkingLevel: string;
}

const ROLE_META: Record<Role, RoleMeta & { label: string }> = {
  explore: { requireThinking: true,  premiumProvider: false, largeContext: true,  thinkingLevel: "low",    label: "explore (scout, read-only)" },
  bulk:    { requireThinking: false, premiumProvider: false, largeContext: true,  thinkingLevel: "low",    label: "bulk (summarize, read-only)" },
  patch:   { requireThinking: true,  premiumProvider: false, largeContext: false, thinkingLevel: "medium", label: "patch (edit, no bash)" },
  review:  { requireThinking: true,  premiumProvider: true,  largeContext: true,  thinkingLevel: "high",   label: "review (quality gate)" },
};

// 프리미엄 티어: 낮을수록 고품질 (review 등에 사용)
const PREMIUM_TIER: Record<string, number> = {
  "openai-codex": 1,  // ChatGPT Plus OAuth
  "openai":       2,
  "anthropic":    2,
  "opencode-go":  3,
  "opencode":     3,
  "deepseek":     4,
  "groq":         4,
  "huggingface":  5,
};

// 예산 티어: 낮을수록 저비용 구독 우선 (explore/bulk/patch에 사용)
const BUDGET_TIER: Record<string, number> = {
  "opencode-go":  1,  // 저비용 구독 (키 기반)
  "opencode":     1,
  "deepseek":     2,
  "groq":         2,
  "huggingface":  3,  // 무료/HF 토큰
  "openai":       4,  // API 종량제 (비쌈)
  "anthropic":    4,
  "openai-codex": 5,  // 프리미엄 구독 → 예산 역할에는 아낌
};

function providerTier(provider: string, premium: boolean): number {
  return premium
    ? (PREMIUM_TIER[provider] ?? 3)
    : (BUDGET_TIER[provider] ?? 3);
}

// ─── 버전 타이브레이커 ───────────────────────────────────────────────────────

function extractVersion(id: string): number[] {
  const m = id.match(/(\d+(?:\.\d+)+)/);
  if (m) return m[1].split(".").map(Number);
  const n = id.match(/(\d+)/);
  return n ? [Number(n[1])] : [0];
}

function cmpVersion(a: string, b: string): number {
  const va = extractVersion(a);
  const vb = extractVersion(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const diff = (vb[i] ?? 0) - (va[i] ?? 0); // 내림차순 (높은 버전 우선)
    if (diff !== 0) return diff;
  }
  return 0;
}

// ─── 모델 선택 휴리스틱 ──────────────────────────────────────────────────────

function rankModels(models: Model[], role: Role, n = 3): Model[] {
  const meta = ROLE_META[role];

  const candidates = meta.requireThinking
    ? models.filter((m) => m.thinking)
    : models;
  const pool = candidates.length > 0 ? candidates : models;

  return [...pool].sort((a, b) => {
    const tierCmp = providerTier(a.provider, meta.premiumProvider)
                  - providerTier(b.provider, meta.premiumProvider);
    if (tierCmp !== 0) return tierCmp;

    const ctxA = parseContext(a.context);
    const ctxB = parseContext(b.context);
    const ctxCmp = meta.largeContext ? ctxB - ctxA : ctxA - ctxB;
    if (ctxCmp !== 0) return ctxCmp;

    return cmpVersion(a.id, b.id);
  }).slice(0, n);
}

/** 사용 가능한 모델 목록에서 역할별 후보 top 3 생성 */
export function propose(models: Model[]): Record<Role, Model[]> {
  const proposals = {} as Record<Role, Model[]>;
  for (const role of ROLES) {
    proposals[role] = rankModels(models, role);
  }
  return proposals;
}

// ─── 메인 모델 ────────────────────────────────────────────────────────────────

interface GlobalSettings {
  defaultProvider?: string;
  defaultModel?: string;
  [key: string]: unknown;
}

const GLOBAL_SETTINGS_PATH = resolve(homedir(), ".pi", "agent", "settings.json");

export async function readGlobalSettings(): Promise<GlobalSettings> {
  const f = Bun.file(GLOBAL_SETTINGS_PATH);
  return (await f.exists()) ? (await f.json() as GlobalSettings) : {};
}

/** 메인 오케스트레이터용 후보 top 3: 프리미엄·thinking·대컨텍스트 우선 */
export function proposeMain(models: Model[], n = 3): Model[] {
  const candidates = models.filter((m) => m.thinking);
  const pool = candidates.length > 0 ? candidates : models;

  return [...pool].sort((a, b) => {
    const tierCmp = (PREMIUM_TIER[a.provider] ?? 3) - (PREMIUM_TIER[b.provider] ?? 3);
    if (tierCmp !== 0) return tierCmp;

    const ctxCmp = parseContext(b.context) - parseContext(a.context);
    if (ctxCmp !== 0) return ctxCmp;

    return cmpVersion(a.id, b.id);
  }).slice(0, n);
}

async function patchGlobalSettings(providerModel: string): Promise<void> {
  const [provider, ...rest] = providerModel.split("/");
  const model = rest.join("/");

  const f = Bun.file(GLOBAL_SETTINGS_PATH);
  const settings: GlobalSettings = (await f.exists()) ? (await f.json() as GlobalSettings) : {};

  settings.defaultProvider = provider;
  settings.defaultModel = model;

  await mkdir(dirname(GLOBAL_SETTINGS_PATH), { recursive: true });
  await Bun.write(GLOBAL_SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  console.log(`  ✓ ~/.pi/agent/settings.json defaultModel updated → ${providerModel}`);
}

// ─── 출력 ────────────────────────────────────────────────────────────────────

export async function printProposals(
  proposals: Record<Role, Model[]>,
  mainCandidates: Model[],
  providers: string[]
): Promise<void> {
  const global = await readGlobalSettings();
  const currentMain = global.defaultModel
    ? `${global.defaultProvider}/${global.defaultModel}`
    : null;

  console.log("\n[subagents] Available providers:", providers.join(", "));

  console.log("\n[subagents] Main orchestrator model:");
  if (currentMain) {
    console.log(`  current: ${currentMain}  [configured]`);
  } else {
    console.log(`  (not configured — shortlist below)`);
  }
  mainCandidates.forEach((m, i) => {
    const tag = currentMain === `${m.provider}/${m.id}` ? "  ← current" : "";
    console.log(`    ${i + 1}. ${m.provider}/${m.id}  [ctx:${m.context}]${tag}`);
  });

  console.log("\n[subagents] Subagent shortlisted candidates (agent picks final):\n");
  for (const role of ROLES) {
    const candidates = proposals[role];
    const meta = ROLE_META[role];
    console.log(`  ${role} (thinking:${meta.thinkingLevel}):`);
    if (candidates.length === 0) {
      console.log(`    (none available)`);
    } else {
      candidates.forEach((m, i) => {
        console.log(`    ${i + 1}. ${m.provider}/${m.id}  [ctx:${m.context}]`);
      });
    }
  }

  console.log(`
Agent will analyze candidates and select the best model per role.
`);
}

// ─── 적용 ────────────────────────────────────────────────────────────────────

/** .pi/settings.json agentOverrides 패치 */
async function patchSettings(targetDir: string, assignments: Record<Role, string>): Promise<void> {
  const path = resolve(targetDir, ".pi", "settings.json");
  const f = Bun.file(path);
  const settings = (await f.exists()) ? (await f.json() as Record<string, unknown>) : {};

  const subagents = (settings.subagents as Record<string, unknown>) ?? {};
  const overrides = (subagents.agentOverrides as Record<string, unknown>) ?? {};

  for (const [role, model] of Object.entries(assignments)) {
    const meta = ROLE_META[role as Role];
    overrides[role] = { model, thinking: meta.thinkingLevel };
  }

  settings.subagents = { ...subagents, agentOverrides: overrides };

  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, JSON.stringify(settings, null, 2) + "\n");
  console.log(`  ✓ .pi/settings.json agentOverrides updated`);
}

/** templates/subagents/.pi/agents/*.md → .pi/agents/ 복사 + model 필드 주입 */
async function writeAgentFiles(targetDir: string, assignments: Record<Role, string>): Promise<void> {
  const agentsDir = resolve(targetDir, ".pi", "agents");
  await mkdir(agentsDir, { recursive: true });

  for (const role of ROLES) {
    const model = assignments[role];
    const srcPath = join(TEMPLATES_DIR, `${role}.md`);
    const destPath = join(agentsDir, `${role}.md`);

    const src = Bun.file(srcPath);
    if (!await src.exists()) {
      console.log(`  · ${role}.md (template not found, skipped)`);
      continue;
    }

    let content = await src.text();

    // frontmatter에 model 필드 주입 (---\n 블록 내 name: 다음 줄에 삽입)
    if (model) {
      content = content.replace(
        /^(---\n(?:.*\n)*?)(---)/m,
        (_, front, close) => {
          // 이미 model: 있으면 교체, 없으면 추가
          if (front.includes("\nmodel:")) {
            return front.replace(/\nmodel:.*/, `\nmodel: ${model}`) + close;
          }
          return front + `model: ${model}\n` + close;
        }
      );
    }

    await Bun.write(destPath, content);
    console.log(`  ✓ .pi/agents/${role}.md${model ? ` (model: ${model})` : ""}`);
  }
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

export interface SubagentsOptions {
  target: string;
  list: boolean;
  apply: boolean;
  main?: string;
  explore?: string;
  bulk?: string;
  patch?: string;
  review?: string;
}

export async function runSubagents(opts: SubagentsOptions): Promise<void> {
  // pi-subagents 설치 확인 (target 디렉토리 기준으로 project scope 검사)
  const listResult = await $`mise exec -- pi list`.cwd(resolve(opts.target)).quiet().nothrow();
  const piList = listResult.stdout.toString();
  if (!piList.includes("pi-subagents")) {
    console.error("[subagents] pi-subagents not installed in project scope.");
    console.error("  Run: pi install npm:pi-subagents -l");
    process.exit(1);
  }

  const models = await listModels();
  if (models.length === 0) {
    console.error("[subagents] No models found. Check pi authentication: pi /login");
    process.exit(1);
  }

  const providers = getProviders(models);
  const proposals = propose(models);
  const mainCandidates = proposeMain(models);

  if (opts.list || !opts.apply) {
    await printProposals(proposals, mainCandidates, providers);
    return;
  }

  // --apply: 커스텀 값 우선, 없으면 shortlist[0] 사용 (에이전트가 --apply 전에 명시적으로 지정)
  const top = (role: Role) => {
    const m = proposals[role][0];
    return m ? `${m.provider}/${m.id}` : "";
  };
  const assignments: Record<Role, string> = {
    explore: opts.explore ?? top("explore"),
    bulk:    opts.bulk    ?? top("bulk"),
    patch:   opts.patch   ?? top("patch"),
    review:  opts.review  ?? top("review"),
  };

  console.log("\n[subagents] Applying configuration...\n");

  if (opts.main) {
    await patchGlobalSettings(opts.main);
  }
  await patchSettings(opts.target, assignments);
  await writeAgentFiles(opts.target, assignments);

  console.log("\n[subagents] Done. Verify with: mise run verify -- --target " + opts.target);
}
