---
name: pi-workspace-extensions
description: pi 확장 패키지 카탈로그를 조회하고 프로젝트 스코프로 설치한다. pi install -l 명령을 사용해 프로젝트 단위로 관리한다.
---

# Pi Workspace — Extensions

pi 확장 패키지를 카탈로그에서 선택해 프로젝트 스코프로 설치한다.

## 실행 규칙

**에이전트는 파일을 직접 작성하지 않는다.** 설치는 mise 태스크가 수행한다.

```bash
cd .pi/skills/pi-workspace   # 또는 .agents/skills/pi-workspace
```

## 플로우

1. 카탈로그 + 현재 설치 상태 출력
   ```bash
   mise run extensions -- --target <path>
   ```

2. 설치할 패키지 선택 (인터렉션)
   - `ask_user_question` 있음 → pi 환경 — 해당 도구 사용
   - `AskUserQuestion` 있음 → Claude Code — 해당 도구 사용
   - 둘 다 없음 → 텍스트로 목록 나열

3. 선택한 패키지 설치
   ```bash
   mise run extensions -- --target <path> --install context-mode,pi-lens
   ```

## 카탈로그

| 패키지 | 카테고리 | 설명 |
|--------|----------|------|
| `pi-subagents` | workflow | 서브에이전트 위임 (subagents 필수) |
| `context-mode` | workflow | 컨텍스트 관리 |
| `ask-user-question` | workflow | 구조화된 질문 다이얼로그 |
| `rpiv-todo` | workflow | 태스크 관리 |
| `pi-lens` | quality | 코드 품질 분석 |
| `pi-web-access` | integration | 웹 접근 |
| `pi-mcp-adapter` | integration | MCP 연동 |
| `pi-powerline-footer` | ui | 상태 표시줄 |

## 금지

- 유저 스코프 설치 금지 — 반드시 프로젝트 스코프(`-l`)로 설치
- settings.json 직접 수정 금지 — `pi install` CLI 우선
