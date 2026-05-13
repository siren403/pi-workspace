import { resolve, join, dirname } from "path";
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

// ─── 모델 선택 휴리스틱 ──────────────────────────────────────────────────────

function pickModel(models: Model[], role: Role): Model | undefined {
  const meta = ROLE_META[role];

  const candidates = meta.requireThinking
    ? models.filter((m) => m.thinking)
    : models;
  if (candidates.length === 0) return models[0];

  return [...candidates].sort((a, b) => {
    const tierA = providerTier(a.provider, meta.premiumProvider);
    const tierB = providerTier(b.provider, meta.premiumProvider);

    // 두 티어 모두 낮을수록 우선 (premium/budget 기준이 티어 테이블에 내장됨)
    const tierCmp = tierA - tierB;
    if (tierCmp !== 0) return tierCmp;

    // 같은 티어 내에서 컨텍스트 기준 정렬
    const ctxA = parseContext(a.context);
    const ctxB = parseContext(b.context);
    return meta.largeContext ? ctxB - ctxA : ctxA - ctxB;
  })[0];
}

/** 사용 가능한 모델 목록에서 역할별 제안 생성 */
export function propose(models: Model[]): Record<Role, Model | undefined> {
  const proposals = {} as Record<Role, Model | undefined>;
  for (const role of ROLES) {
    proposals[role] = pickModel(models, role);
  }
  return proposals;
}

// ─── 출력 ────────────────────────────────────────────────────────────────────

export function printProposals(
  proposals: Record<Role, Model | undefined>,
  providers: string[]
): void {
  console.log("\n[subagents] Available providers:", providers.join(", "));
  console.log("\n[subagents] Proposed role assignments:\n");

  for (const role of ROLES) {
    const m = proposals[role];
    const meta = ROLE_META[role];
    const modelStr = m ? `${m.provider}/${m.id}` : "(none available)";
    console.log(`  ${role.padEnd(10)} thinking:${meta.thinkingLevel.padEnd(7)} → ${modelStr}`);
  }

  console.log(`
To apply:
  mise run subagents -- --target <path> --apply

To customise:
  mise run subagents -- --target <path> --apply \\
    --explore opencode-go/deepseek-v4-flash \\
    --review  openai-codex/gpt-5.5
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
  explore?: string;
  bulk?: string;
  patch?: string;
  review?: string;
}

export async function runSubagents(opts: SubagentsOptions): Promise<void> {
  // pi-subagents 설치 확인
  const listResult = await $`pi list`.quiet().nothrow();
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

  if (opts.list || !opts.apply) {
    printProposals(proposals, providers);
    return;
  }

  // --apply: 커스텀 값 우선, 없으면 제안값 사용
  const assignments: Record<Role, string> = {
    explore: opts.explore ?? (proposals.explore ? `${proposals.explore.provider}/${proposals.explore.id}` : ""),
    bulk:    opts.bulk    ?? (proposals.bulk    ? `${proposals.bulk.provider}/${proposals.bulk.id}`       : ""),
    patch:   opts.patch   ?? (proposals.patch   ? `${proposals.patch.provider}/${proposals.patch.id}`     : ""),
    review:  opts.review  ?? (proposals.review  ? `${proposals.review.provider}/${proposals.review.id}`   : ""),
  };

  console.log("\n[subagents] Applying configuration...\n");
  await patchSettings(opts.target, assignments);
  await writeAgentFiles(opts.target, assignments);

  console.log("\n[subagents] Done. Verify with: mise run verify -- --target " + opts.target);
}
