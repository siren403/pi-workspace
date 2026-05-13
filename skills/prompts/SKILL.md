---
name: pi-workspace-prompts
description: AGENTS.md에 에이전트 행동 지침 프롬프트를 관리한다. 알려진 템플릿 설치(정적)와 프로젝트 맞춤 합성(동적) 두 가지 모드를 지원한다.
---

# Pi Workspace — Prompts

AGENTS.md에 에이전트 행동 지침 프롬프트를 관리한다.

## 실행 규칙

**에이전트는 파일을 직접 작성하지 않는다.** 모든 파일 쓰기는 mise 태스크가 수행한다.

```bash
cd .pi/skills/pi-workspace   # 또는 .agents/skills/pi-workspace
```

## 호출 패턴

### 1. args 없음 — 스마트 모드

```bash
mise run prompts -- --target <path> --context
```

- AGENTS.md에 pi-prompts 섹션 없음 → `suggest` 흐름 진입
- 섹션 있음 → 현재 구성 요약 + 갱신 제안

### 2. 명시적 args

| args | mise 태스크 |
|------|------------|
| `list` | `mise run prompts -- --list` |
| `preview <slug\|owner/repo>` | `mise run prompts -- --preview <slug>` |
| `install <slug>[,...]` | `mise run prompts -- --target <path> --install <slug>` |
| `suggest` | `--context` → 분석 → 추천 |
| `compose [slug,...]` | `--context` + `--preview` → 합성 → `--write` |

### 3. 자유 요청

의도를 파악해 위 흐름으로 라우팅:

| 키워드 | 라우팅 |
|--------|--------|
| 합성, 조합, 맞게, 다듬어 | `compose` |
| 추천, 뭐가 좋아 | `suggest` |
| 추가, 설치 + slug | `install` |
| 보여줘, 내용 | `preview` / `list` |

## suggest / compose 절차

1. `mise run prompts -- --target <path> --context` → 프로젝트 정보 수집
2. `compose` 시 `mise run prompts -- --preview <slug>` → 템플릿 fetch
3. 에이전트가 컨텍스트 + 템플릿으로 합성
4. 결과를 사용자에게 제안 — **확인 전 파일에 쓰지 않는다**
5. 승인 후:
   ```bash
   echo "<합성 내용>" | mise run prompts -- --target <path> --write --section <name>
   ```

## 섹션 마커 형식

```
<!-- pi-prompts:karpathy:start -->
...
<!-- pi-prompts:karpathy:end -->
```

## 인터렉션 방식

- `ask_user_question` 있음 → pi 환경 — 해당 도구 사용
- `AskUserQuestion` 있음 → Claude Code — 해당 도구 사용
- 둘 다 없음 → 텍스트로 선택지 나열
