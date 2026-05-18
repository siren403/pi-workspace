---
name: pi-workspace-extensions
description: pi 확장 패키지 카탈로그를 조회하고 feature·recipe·extension profile 기반 추천과 scope-aware 설치를 수행한다.
---

# Pi Workspace — Extensions

pi 확장 패키지를 카탈로그에서 선택한다. 기본은 프로젝트 스코프 설치지만, 상태라인처럼 개인 에이전트 UI에 가까운 확장은 카탈로그의 추천 스코프와 이유를 설명한 뒤 user scope 설치를 제안할 수 있다.

## 실행 규칙

**에이전트는 파일을 직접 작성하지 않는다.** 설치는 mise 태스크가 수행한다.

```bash
cd .pi/skills/pi-workspace   # 또는 .agents/skills/pi-workspace
mise trust                   # 새 설치 경로에서는 최초 1회 필요
```

## 플로우

1. 카탈로그 + 현재 설치 상태 + 추천 스코프 출력
   ```bash
   mise run extensions -- --target <path>
   ```

2. 필요하면 feature / recipe / extension profile 기반 추천 출력
   ```bash
   mise run extensions -- --target <path> --feature statusline
   mise run extensions -- --target <path> --recipe multi-provider-statusline
   mise run extensions -- --target <path> --profile codex-opencode
   ```

   추천 출력은 read-only다. 패키지를 설치하거나 제거하지 않는다.

3. 설치할 패키지와 scope 선택 (인터렉션)
   - `ask_user_question` 있음 → pi 환경 — 해당 도구 사용
   - `AskUserQuestion` 있음 → Claude Code — 해당 도구 사용
   - 둘 다 없음 → 텍스트로 목록 나열

4. 선택한 패키지 설치
   ```bash
   mise run extensions -- --target <path> --install context-mode,pi-lens --scope project
   mise run extensions -- --target <path> --install pi-powerline-footer --scope user
   ```

   `--scope`를 생략하면 각 패키지의 `recommendedScope`를 사용한다.

## 카탈로그

| 패키지 | 카테고리 | 기본 추천 scope | 설명 |
|--------|----------|------------------|------|
| `pi-subagents` | workflow | project | 서브에이전트 위임 (subagents 필수) |
| `context-mode` | workflow | project | 컨텍스트 관리 |
| `ask-user-question` | workflow | user | 구조화된 질문 다이얼로그 |
| `rpiv-todo` | workflow | project | 태스크 관리 |
| `pi-lens` | quality | project | 코드 품질 분석 |
| `pi-web-access` | integration | project | 웹 접근 |
| `pi-mcp-adapter` | integration | project | MCP 연동 |
| `pi-powerline-footer` | ui | user | 상태 표시줄 |

## 추천 모델

- package: 실제 `pi install` 대상
- feature: `statusline`, `lsp`, `web-access` 같은 기능 단위
- recipe: 목적별 feature/package 조합
- extension profile: 사용자/프로젝트 성향 기반 추천 묶음

extension profile은 scaffold manifest의 `profile`과 다르다. profile은 advisory recommendation이며 자동 설치·삭제를 의미하지 않는다.

## 금지

- 카탈로그 추천만으로 자동 설치·삭제 금지
- user scope 설치는 카탈로그가 허용하고 이유를 출력한 뒤 사용자 승인을 받은 경우에만 허용
- installed-but-not-recommended 또는 nonrecommended scope 상태를 제거 명령으로 바꾸지 말 것
- settings.json 직접 수정 금지 — `pi install` CLI 우선
