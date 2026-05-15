---
name: pi-workspace-subagents
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
mise trust                   # 새 설치 경로에서는 최초 1회 필요
```

## 플로우

1. 메인 모델 현황 + 역할별 후보 shortlist 출력
   ```bash
   mise run subagents -- --target <path>
   ```
   스크립트는 다음을 출력한다:
   - `~/.pi/agent/settings.json`의 현재 `defaultModel` (없으면 "not configured")
   - 메인 오케스트레이터용 후보 top 3 (프리미엄·thinking·대컨텍스트 우선)
   - 서브에이전트 역할별 후보 top 3 (tier → context → 버전 내림차순)

2. **에이전트가 후보를 분석해 메인 모델 + 역할별 최적 모델 선택**

   메인 모델 판단:
   - 현재 설정이 있고 후보 목록에 존재 → 유지 제안 (변경 불필요)
   - 현재 설정이 없거나 후보 목록에 없음 → shortlist에서 선택
   - `mini` / `micro` / `spark` 접미사 → 오케스트레이터 부적합

   서브에이전트 판단 기준 (우선순위 순):
   - `mini` / `micro` / `spark` / `flash` 접미사 → 경량 모델, review에 부적합
   - `max` / `pro` / `plus` 접미사 → 고성능, review·patch에 적합
   - 버전 숫자가 높을수록 우선 (동일 tier·context일 때)
   - 인식 불가 패턴은 후보 중 가장 높은 버전 선택

   역할별 특성:
   | 역할 | 우선순위 | 특성 |
   |------|----------|------|
   | `main` | premium | 메인 오케스트레이터, thinking, 고성능 우선 |
   | `explore` | budget | 탐색·읽기 전용, thinking |
   | `bulk` | budget | 대량 요약, thinking 불필요 |
   | `patch` | budget | 단순 패치 적용, thinking |
   | `review` | premium | 품질 게이트, thinking, 고성능 우선 |

3. 선택 결과와 근거를 사용자에게 제시 후 확인

4. 승인 후 **선택 모델을 명시적으로 지정해서** 적용
   ```bash
   mise run subagents -- --target <path> --apply \
     --main    <provider/model> \
     --explore <provider/model> \
     --bulk    <provider/model> \
     --patch   <provider/model> \
     --review  <provider/model>
   ```
   메인 모델 유지 시 `--main` 생략.

## 인터렉션 방식

- `ask_user_question` 있음 → pi 환경 — 해당 도구 사용
- `AskUserQuestion` 있음 → Claude Code 환경 — 해당 도구 사용
- 둘 다 없음 → 텍스트로 선택지 나열

## 금지

- pi 인증 여부 확인 없이 진행 금지
- 모델 ID 하드코딩 금지 — `pi --list-models`로 실제 값 확인
