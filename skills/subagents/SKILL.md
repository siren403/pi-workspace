---
name: pi-workspace:subagents
description: 인증된 프로바이더를 기반으로 pi 서브에이전트 역할(explore/bulk/patch/review)을 구성한다. pi --list-models로 사용 가능한 모델을 파악한 뒤 제안한다.
---

# Pi Workspace — Subagents

인증된 프로바이더의 모델 목록을 파악해 역할별 서브에이전트를 구성한다.

## 선행 조건

- pi 인증 완료 (`pi /login`)
- pi-subagents 설치 (`pi install npm:pi-subagents -l`)

## 실행 규칙

**에이전트는 파일을 직접 작성하지 않는다.** 모든 설정은 mise 태스크가 수행한다.

```bash
cd .pi/skills/pi-workspace   # 또는 .agents/skills/pi-workspace
```

## 플로우

1. 모델 목록 제안 출력
   ```bash
   mise run subagents -- --target <path>
   ```
2. 역할별 모델 제안 확인 (또는 수정)

   | 역할 | 우선순위 | 특성 |
   |------|----------|------|
   | `explore` | budget | 탐색·읽기 전용, thinking |
   | `bulk` | budget | 대량 요약, thinking 불필요 |
   | `patch` | budget | 단순 패치 적용, thinking |
   | `review` | premium | 품질 게이트, thinking |

3. 승인 후 적용
   ```bash
   mise run subagents -- --target <path> --apply
   # 특정 모델 지정 시:
   mise run subagents -- --target <path> --apply \
     --explore opencode-go/deepseek-v3 \
     --review  openai-codex/gpt-5.5
   ```

## 인터렉션 방식

- `ask_user_question` 있음 → pi 환경 — 해당 도구 사용
- `AskUserQuestion` 있음 → Claude Code 환경 — 해당 도구 사용
- 둘 다 없음 → 텍스트로 선택지 나열

## 금지

- pi 인증 여부 확인 없이 진행 금지
- 모델 ID 하드코딩 금지 — `pi --list-models`로 실제 값 확인
