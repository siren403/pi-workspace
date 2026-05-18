export type ExtensionCategory = "workflow" | "quality" | "integration" | "ui";
export type ExtensionStatus = "listed" | "recommended" | "experimental" | "deprecated" | "blocked";
export type ExtensionScope = "project" | "user";

export interface ExtensionPackage {
  id: string;
  pkg: string;
  name: string;
  description: string;
  category: ExtensionCategory;
  status: ExtensionStatus;
  features: string[];
  recommendedScope: ExtensionScope;
  allowedScopes: ExtensionScope[];
  scopeRationale: string;
  rationale?: string;
  risks?: string[];
  alternatives?: string[];
}

export interface ExtensionFeature {
  id: string;
  name: string;
  description: string;
  packages: string[];
  optionalPackages?: string[];
}

export interface ExtensionRecipe {
  id: string;
  name: string;
  description: string;
  features?: string[];
  packages?: string[];
  optionalPackages?: string[];
  rationale: string;
}

export interface ExtensionProfile {
  id: string;
  name: string;
  description: string;
  features?: string[];
  recipes?: string[];
  packages?: string[];
  rationale: string;
  advisory: true;
}

export const EXTENSIONS_CATALOG: ExtensionPackage[] = [
  // Workflow
  {
    id: "pi-subagents",
    pkg: "npm:pi-subagents",
    name: "pi-subagents",
    description: "pi agentOverrides와 역할별 서브에이전트 구성을 지원.",
    category: "workflow",
    status: "recommended",
    features: ["subagents"],
    recommendedScope: "project",
    allowedScopes: ["project"],
    scopeRationale: "서브에이전트 구성은 프로젝트별 모델/역할 정책과 함께 관리하는 편이 안전함.",
    rationale: "pi-workspace subagents primitive가 기대하는 기본 확장.",
  },
  {
    id: "context-mode",
    pkg: "npm:context-mode",
    name: "context-mode",
    description: "컨텍스트 윈도우 98% 절약. FTS5 기반 지식베이스·의도 검색.",
    category: "workflow",
    status: "recommended",
    features: ["context-management"],
    recommendedScope: "project",
    allowedScopes: ["project", "user"],
    scopeRationale: "컨텍스트 인덱스와 작업 지식은 보통 repo별로 달라 project scope가 기본값.",
    rationale: "큰 코드베이스와 장기 작업에서 컨텍스트 압박을 줄임.",
  },
  {
    id: "ask-user-question",
    pkg: "npm:@juicesharp/rpiv-ask-user-question",
    name: "ask-user-question",
    description: "모델이 추측 대신 구조화된 질문을 사용자에게 제시.",
    category: "workflow",
    status: "recommended",
    features: ["user-interaction"],
    recommendedScope: "user",
    allowedScopes: ["user", "project"],
    scopeRationale: "질문 UX는 개인 에이전트 사용 방식에 가까워 여러 프로젝트에서 재사용하기 좋음.",
    rationale: "불확실한 요구사항에서 추측 대신 명시적 확인을 유도함.",
  },
  {
    id: "rpiv-todo",
    pkg: "npm:@juicesharp/rpiv-todo",
    name: "rpiv-todo",
    description: "모델용 태스크 목록. /reload·컴팩션 후에도 유지되는 오버레이.",
    category: "workflow",
    status: "listed",
    features: ["task-tracking"],
    recommendedScope: "project",
    allowedScopes: ["project", "user"],
    scopeRationale: "작업 목록은 repo 상태와 연결되는 경우가 많아 project scope가 기본값.",
  },

  // Code Quality
  {
    id: "pi-lens",
    pkg: "npm:pi-lens",
    name: "pi-lens",
    description: "실시간 코드 피드백. LSP·린터·포매터·타입체크·구조 분석.",
    category: "quality",
    status: "recommended",
    features: ["lsp", "code-quality"],
    recommendedScope: "project",
    allowedScopes: ["project"],
    scopeRationale: "LSP/린터/타입체크 설정은 언어와 repo 구조에 강하게 의존함.",
    rationale: "다언어 코드베이스나 품질 게이트가 필요한 프로젝트에서 즉시 가치가 큼.",
  },

  // Integration
  {
    id: "pi-web-access",
    pkg: "npm:pi-web-access",
    name: "pi-web-access",
    description: "웹 검색·URL 페치·GitHub 클론·PDF 추출·YouTube 분석.",
    category: "integration",
    status: "listed",
    features: ["web-access", "research"],
    recommendedScope: "project",
    allowedScopes: ["project", "user"],
    scopeRationale: "네트워크 접근은 프로젝트 정책에 따라 허용 범위가 달라질 수 있어 project scope가 기본값.",
    risks: ["network-access"],
  },
  {
    id: "pi-mcp-adapter",
    pkg: "npm:pi-mcp-adapter",
    name: "pi-mcp-adapter",
    description: "MCP(Model Context Protocol) 서버 연동.",
    category: "integration",
    status: "listed",
    features: ["mcp"],
    recommendedScope: "project",
    allowedScopes: ["project", "user"],
    scopeRationale: "MCP 서버와 권한은 repo/업무별로 다르므로 project scope로 시작하는 편이 안전함.",
    risks: ["external-tool-access"],
  },

  // UI
  {
    id: "pi-powerline-footer",
    pkg: "npm:pi-powerline-footer",
    name: "pi-powerline-footer",
    description: "파워라인 스타일 상태바.",
    category: "ui",
    status: "listed",
    features: ["statusline"],
    recommendedScope: "user",
    allowedScopes: ["user", "project"],
    scopeRationale: "상태라인은 개인 에이전트 UI 선호에 가깝고 여러 프로젝트에서 반복 사용됨.",
  },
];

export const EXTENSION_FEATURES: ExtensionFeature[] = [
  {
    id: "subagents",
    name: "Subagents",
    description: "역할별 모델 위임과 agentOverrides 구성.",
    packages: ["pi-subagents"],
  },
  {
    id: "context-management",
    name: "Context management",
    description: "큰 코드베이스와 장기 대화에서 필요한 컨텍스트 압축/검색.",
    packages: ["context-mode"],
  },
  {
    id: "user-interaction",
    name: "User interaction",
    description: "추측 대신 구조화된 사용자 확인을 받을 수 있는 인터랙션.",
    packages: ["ask-user-question"],
  },
  {
    id: "task-tracking",
    name: "Task tracking",
    description: "컴팩션과 세션 전환에도 유지되는 작업 목록.",
    packages: ["rpiv-todo"],
  },
  {
    id: "lsp",
    name: "LSP",
    description: "언어 서버 기반 코드 이해와 진단.",
    packages: ["pi-lens"],
  },
  {
    id: "code-quality",
    name: "Code quality",
    description: "린터, 포매터, 타입체크, 구조 분석 기반 피드백.",
    packages: ["pi-lens"],
  },
  {
    id: "web-access",
    name: "Web access",
    description: "웹 검색, URL/PDF/영상 분석, GitHub 자료 수집.",
    packages: ["pi-web-access"],
  },
  {
    id: "research",
    name: "Research",
    description: "외부 자료를 근거로 조사하고 이슈/PR 맥락을 보강.",
    packages: ["pi-web-access"],
  },
  {
    id: "mcp",
    name: "MCP",
    description: "MCP 서버를 pi 환경에 연결.",
    packages: ["pi-mcp-adapter"],
  },
  {
    id: "statusline",
    name: "Statusline",
    description: "에이전트 UI 하단 상태 표시.",
    packages: ["pi-powerline-footer"],
  },
];

export const EXTENSION_RECIPES: ExtensionRecipe[] = [
  {
    id: "baseline-agent-workflow",
    name: "Baseline agent workflow",
    description: "대부분의 agent workspace에 유용한 기본 작업 흐름.",
    features: ["subagents", "context-management", "user-interaction"],
    rationale: "역할 위임, 컨텍스트 관리, 질문 UX는 프로젝트 규모와 무관하게 자주 필요함.",
  },
  {
    id: "multi-provider-statusline",
    name: "Multi-provider statusline",
    description: "Codex, OpenCode, pi 등 여러 에이전트/프로바이더를 오갈 때 상태 표시를 개인 환경에 둔다.",
    features: ["statusline"],
    rationale: "상태라인은 프로젝트 산출물보다 개인 작업 환경의 반복 UI에 가까움.",
  },
  {
    id: "polyglot-codebase",
    name: "Polyglot codebase",
    description: "다언어 repo에서 LSP와 품질 피드백을 우선 활성화.",
    features: ["lsp", "code-quality"],
    rationale: "언어와 도구가 섞인 프로젝트에서는 코드 이해/진단 확장의 가치가 큼.",
  },
  {
    id: "contribution-research",
    name: "Contribution research",
    description: "이슈/PR 제안을 만들 때 외부 자료와 프로젝트 맥락을 보강.",
    features: ["research"],
    optionalPackages: ["pi-mcp-adapter"],
    rationale: "외부 문서와 upstream 자료를 확인해야 catalog/recipe 제안 품질이 안정됨.",
  },
];

export const EXTENSION_PROFILES: ExtensionProfile[] = [
  {
    id: "general-dev",
    name: "General development",
    description: "대부분의 프로젝트에 맞는 보수적인 기본 추천.",
    recipes: ["baseline-agent-workflow"],
    rationale: "프로젝트별 격리를 유지하면서 agent workspace 기본기를 갖춤.",
    advisory: true,
  },
  {
    id: "codex-opencode",
    name: "Codex + OpenCode user",
    description: "여러 코딩 에이전트를 오가는 개인 환경 추천.",
    recipes: ["baseline-agent-workflow", "multi-provider-statusline"],
    rationale: "project scope 기본값은 유지하되 상태라인 같은 개인 UI는 user scope를 추천함.",
    advisory: true,
  },
  {
    id: "polyglot",
    name: "Polyglot codebase",
    description: "다언어 코드베이스를 다루는 프로젝트 추천.",
    recipes: ["baseline-agent-workflow", "polyglot-codebase"],
    rationale: "LSP/품질 피드백은 repo 특성에 따라 project scope로 관리하는 편이 좋음.",
    advisory: true,
  },
  {
    id: "catalog-contributor",
    name: "Catalog contributor",
    description: "pi-workspace catalog, recipe, profile 제안을 준비하는 사용자 추천.",
    recipes: ["contribution-research"],
    packages: ["ask-user-question"],
    rationale: "좋은 제안에는 근거 수집, scope 판단, 명시적 질문 흐름이 필요함.",
    advisory: true,
  },
];

export const CATEGORY_LABEL: Record<ExtensionCategory, string> = {
  workflow:    "워크플로",
  quality:     "코드 품질",
  integration: "통합",
  ui:          "UI",
};

export function findExtensionPackage(idOrNameOrPkg: string): ExtensionPackage | undefined {
  const normalized = idOrNameOrPkg.trim();
  const withoutNpm = normalized.replace(/^npm:/, "");
  return EXTENSIONS_CATALOG.find((ext) =>
    ext.id === normalized ||
    ext.name === normalized ||
    ext.pkg === normalized ||
    ext.pkg.replace(/^npm:/, "") === withoutNpm
  );
}

export function resolveFeaturePackageIds(featureId: string): string[] {
  const feature = EXTENSION_FEATURES.find((item) => item.id === featureId);
  return feature ? [...feature.packages, ...(feature.optionalPackages ?? [])] : [];
}

export function resolveRecipePackageIds(recipeId: string): string[] {
  const recipe = EXTENSION_RECIPES.find((item) => item.id === recipeId);
  if (!recipe) return [];
  return [
    ...(recipe.packages ?? []),
    ...(recipe.optionalPackages ?? []),
    ...(recipe.features ?? []).flatMap((featureId) => resolveFeaturePackageIds(featureId)),
  ];
}

export function resolveProfilePackageIds(profileId: string): string[] {
  const profile = EXTENSION_PROFILES.find((item) => item.id === profileId);
  if (!profile) return [];
  return [
    ...(profile.packages ?? []),
    ...(profile.features ?? []).flatMap((featureId) => resolveFeaturePackageIds(featureId)),
    ...(profile.recipes ?? []).flatMap((recipeId) => resolveRecipePackageIds(recipeId)),
  ];
}
