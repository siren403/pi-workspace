export interface Extension {
  pkg: string;          // npm 패키지명
  name: string;         // 표시명
  description: string;  // 한 줄 설명
  category: "workflow" | "quality" | "integration" | "ui";
  recommended: boolean; // 대부분의 프로젝트에 권장
}

export const EXTENSIONS_CATALOG: Extension[] = [
  // Workflow
  {
    pkg: "npm:context-mode",
    name: "context-mode",
    description: "컨텍스트 윈도우 98% 절약. FTS5 기반 지식베이스·의도 검색.",
    category: "workflow",
    recommended: true,
  },
  {
    pkg: "npm:@juicesharp/rpiv-ask-user-question",
    name: "ask-user-question",
    description: "모델이 추측 대신 구조화된 질문을 사용자에게 제시.",
    category: "workflow",
    recommended: true,
  },
  {
    pkg: "npm:@juicesharp/rpiv-todo",
    name: "rpiv-todo",
    description: "모델용 태스크 목록. /reload·컴팩션 후에도 유지되는 오버레이.",
    category: "workflow",
    recommended: false,
  },

  // Code Quality
  {
    pkg: "npm:pi-lens",
    name: "pi-lens",
    description: "실시간 코드 피드백. LSP·린터·포매터·타입체크·구조 분석.",
    category: "quality",
    recommended: true,
  },

  // Integration
  {
    pkg: "npm:pi-web-access",
    name: "pi-web-access",
    description: "웹 검색·URL 페치·GitHub 클론·PDF 추출·YouTube 분석.",
    category: "integration",
    recommended: false,
  },
  {
    pkg: "npm:pi-mcp-adapter",
    name: "pi-mcp-adapter",
    description: "MCP(Model Context Protocol) 서버 연동.",
    category: "integration",
    recommended: false,
  },

  // UI
  {
    pkg: "npm:pi-powerline-footer",
    name: "pi-powerline-footer",
    description: "파워라인 스타일 상태바.",
    category: "ui",
    recommended: false,
  },
];

export const CATEGORY_LABEL: Record<Extension["category"], string> = {
  workflow:    "워크플로",
  quality:     "코드 품질",
  integration: "통합",
  ui:          "UI",
};
