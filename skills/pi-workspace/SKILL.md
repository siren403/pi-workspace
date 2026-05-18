---
name: pi-workspace
description: YoloBox + Pi + mise agent workspace를 관리한다. 초기화·검증·갱신·서브에이전트 구성·확장 설치·에이전트 지침 프롬프트 합성을 담당. 파일을 직접 작성하지 말고 반드시 mise 태스크를 실행한다.
---

# Pi Workspace

YoloBox + Pi + mise 기반 agent workspace를 새 프로젝트에 생성하거나 기존 workspace를 갱신·검증·설정한다.

## 기본 진입점

사용자가 목적을 명확히 지정하지 않았거나 어떤 서브커맨드를 써야 할지 애매하면 `/pi-workspace`를 스마트 모드로 실행한다.

스마트 모드는 현재 프로젝트 상태를 진단하고, 필요한 서브커맨드와 실행 계획을 제안한 뒤 사용자 확인을 받아 진행한다.
서브커맨드는 사용자가 외워야 하는 메뉴가 아니라 에이전트와 자동화가 호출하는 명시적 primitive다.

| 커맨드 | 역할 |
|--------|------|
| `/pi-workspace` | 스마트 모드: 진단 → 상태 판단 → 계획 제안 → 승인 후 실행 |
| `/pi-workspace:doctor` | 실행 환경 점검 primitive |
| `/pi-workspace:verify` | 생성된 workspace 무결성 검증 primitive |
| `/pi-workspace:scaffold` | 새 workspace 생성 primitive |
| `/pi-workspace:update` | managedFiles 갱신 primitive |
| `/pi-workspace:subagents` | 인증된 프로바이더 기반 서브에이전트 구성 primitive |
| `/pi-workspace:extensions` | pi 확장 패키지 카탈로그 조회·선택 설치 primitive |
| `/pi-workspace:prompts` | 에이전트 지침 프롬프트 관리·합성 primitive |
| `/pi-workspace:report` | 이슈 리포트 primitive |
| `/pi-workspace:release` | pi-workspace skill package 릴리즈 준비·검증 primitive |

## 설치 확인

`/pi-workspace:scaffold` 같은 서브커맨드가 스킬 목록에 없으면 `--full-depth` 없이 설치된 것이다.
에이전트는 이 상황을 감지하면 사용자에게 재설치를 제안한다:

```bash
mkdir -p .claude
npx skills add siren403/pi-workspace --full-depth
```

감지 기준: 사용자가 `/pi-workspace:scaffold` 등을 호출했는데 스킬을 찾을 수 없다는 응답이 오거나,
현재 스킬 목록에 `pi-workspace-scaffold` 가 없는 경우.

## 스마트 모드 `/pi-workspace`

서브커맨드 없이 호출되면 스마트 모드로 동작한다. 사용자는 내부 mise 태스크를 직접 실행하지 않는다. 에이전트가 내부적으로 설치 경로를 trust하고 상태 수집 task를 실행한다.

```bash
cd .pi/skills/pi-workspace
mise trust --yes
mise exec -- bun --version  # 실패하면 사용자 승인 후: mise install bun
mise run status -- --target <target> --intent "<사용자 요청 원문>"
```

`status` 또는 `doctor`가 `bun is required`로 중단되면 사용자가 승인한 뒤 같은 스킬 디렉터리에서 `mise install bun`을 실행하고, 원래 명령을 재시도한다.
이 bootstrap은 스킬 task 런타임 준비이며 target project 파일을 변경하지 않는다.

`status` task는 파일을 변경하지 않고 스킬 설치 상태, target workspace 상태, 다음 실행 계획을 출력한다. 에이전트는 `Recommended workflow`만 필요한 작업으로 요약하고, `Optional follow-ups`는 선택 항목으로 분리한다.

사용자가 승인하면 에이전트는 `Recommended workflow`를 순서대로 끝까지 진행해 작업 가능한 상태를 만든다. 각 primitive를 다시 메뉴처럼 하나씩 승인받지 않는다. 단, destructive change, managed file overwrite, 외부 설치, 인증 변경처럼 파일/설정에 영향을 주는 실제 변경은 승인 범위 안에서만 수행한다.

`/pi-workspace:update`가 필요한 경우:
- 먼저 managed-file diff를 보여준다.
- 사용자가 “해당 managed update 진행”을 승인하면 같은 승인 흐름 안에서 `--force` 갱신 후 verify까지 진행한다.
- diff가 예상과 다르거나 managed files 밖의 변경이 필요하면 중단하고 다시 확인한다.

`.agent-workspace.json`은 target workspace에 마지막으로 적용된 상태 기록이다. 현재 관리 대상의 유일한 기준으로 사용하지 않는다.
status/update/verify는 항상 현재 설치된 skill의 `templates/scaffold` 파일 목록과 `.agent-workspace.json`의 `managedFiles`를 함께 비교한다.
update 성공 후 `.agent-workspace.json`은 `manifestVersion`, `template.revision`, `managedFiles`를 최신 기준으로 normalize한다.

판단 기준:

1. **스킬 설치/업데이트 상태 확인**
   - `/pi-workspace:scaffold` 같은 서브커맨드가 없으면 `npx skills add siren403/pi-workspace --full-depth` 재설치 제안
   - 사용자가 "업데이트", "재설치", "버전업", "최신"을 언급하면 같은 `add` 명령으로 스킬 갱신 제안

2. **doctor 실행**
   - ERROR → 오류 항목과 수정 방법 안내 후 중단
   - WARN → 계속할지 사용자 확인

3. **workspace 상태 판단**
   - `.agent-workspace.json` 없음 → scaffold 계획 제안
   - workspace 있음 → verify 실행 제안
   - managed files 누락/불일치 의심 → update 후 verify 계획 제안
   - agentOverrides 없음 + pi-subagents 설치됨 → subagents 계획 제안
   - AGENTS.md 프롬프트 섹션 없음 또는 갱신 필요 → prompts suggest/compose 계획 제안

4. **사용자 의도 라우팅**
   - "처음 세팅", "새 프로젝트" → scaffold
   - "상태 확인", "문제 없는지" → doctor 후 필요하면 verify
   - "업데이트", "버전업", "재설치 후 확인" → doctor → verify, 필요하면 update
   - "서브에이전트", "모델" → subagents
   - "확장", "패키지" → extensions
   - "프롬프트", "AGENTS" → prompts
   - "버그", "리포트", "이슈" → report
   - "릴리즈", "배포", "publish", "버전 업데이트" → release

5. **계획 제안 후 실행**
   - `Recommended workflow`는 한 번 승인받고 끝까지 진행
   - `Optional follow-ups`는 사용자가 요청하거나 승인할 때만 진행
   - 승인 전에는 실행 계획과 영향을 받는 파일/설정을 먼저 설명

## 실행 규칙

**에이전트는 파일을 직접 작성하지 않는다.**

모든 파일 생성·갱신은 이 스킬의 mise 태스크가 수행한다.

내부 구현 명령:
```bash
cd .pi/skills/pi-workspace
mise trust --yes
mise exec -- bun --version  # 실패하면 사용자 승인 후: mise install bun

mise run doctor    -- --target <path>
mise run status    -- --target <path> --intent "<사용자 요청 원문>"
mise run scaffold  -- --target <path>
mise run subagents -- --target <path>
mise run extensions -- --target <path>
mise run extensions -- --target <path> --install context-mode,pi-lens
mise run prompts   -- --target <path>
mise run prompts   -- --target <path> --preview karpathy
mise run prompts   -- --target <path> --install karpathy
echo "<content>" | mise run prompts -- --target <path> --write --section <name>
mise run verify    -- --target <path>
mise run update    -- --target <path>
```

scaffold 후 pi 실행:
```bash
mise run pi              # pi 세션 시작
mise run pi:fork         # 폴더 격리 환경
mise run pi:shell -- list  # 비대화형 검증
```

## /pi-workspace:scaffold 플로우

1. **doctor** 실행 → 결과 사용자에게 보고
2. ERROR 있으면 중단. 사용자가 수정 후 재실행 요청할 때까지 대기.
3. WARN은 사용자에게 안내 후 진행 여부 확인.
4. 모두 OK → **scaffold** 실행
5. scaffold 완료 후 **verify** 실행
6. 결과 요약 보고 + extensions·subagents 후속 안내

## /pi-workspace:verify 플로우

1. `mise run verify -- --target <path>` 실행
2. `differs from current template` warning이 있으면 `/pi-workspace:update`로 전환
3. 먼저 `mise run update -- --target <path> --diff`로 변경 내용을 보여줌
4. 사용자가 managed update 적용을 승인하면 `mise run update -- --target <path> --force` 실행
5. 갱신 후 `mise run verify -- --target <path>` 재실행
6. verify 자체에서는 파일을 수정하지 않음

## /pi-workspace:subagents 플로우

> 선행 조건: pi 인증 완료 (`pi /login`), pi-subagents 설치 (`pi install npm:pi-subagents -l`)

1. `pi --list-models` 실행 → 인증된 프로바이더·모델 목록 파악
2. 역할별 모델 후보 제안 (scout=저비용·빠름, oracle=고성능)
3. 사용자 확인 또는 수정
4. `.pi/settings.json` agentOverrides 작성
5. `.pi/agents/*.md` model 필드 주입

## /pi-workspace:extensions 플로우

1. `mise run extensions -- --target <path>` → 카탈로그 + 현재 설치 상태 출력
2. 사용자가 설치할 패키지 선택
3. `mise run extensions -- --target <path> --install <name,...>` 실행
4. `pi install npm:<pkg> -l` 프로젝트 스코프로 설치

## /pi-workspace:prompts 플로우

AGENTS.md에 에이전트 행동 지침 프롬프트를 관리한다.

### 지원 args

| args | 동작 |
|------|------|
| (없음) | **스마트 모드** — 프로젝트 상태 파악 후 다음 행동 제안 |
| `list` | 카탈로그 목록 출력 |
| `preview <slug\|owner/repo>` | 템플릿 내용 출력 |
| `install <slug>[,<slug\|owner/repo>...]` | AGENTS.md에 정적 주입 |
| `suggest` | 프로젝트 분석 후 적합한 템플릿 추천 |
| `compose [<slug\|owner/repo>...]` | 지정 템플릿(들)을 프로젝트에 맞게 합성 |
| `"<자유 요청>"` | 의도를 파악해 위 args 중 적합한 흐름으로 라우팅 |

### args → mise task 매핑

```
# ── 1. 스마트 모드 (args 없음) ──────────────────────────────────────────────
/pi-workspace:prompts
  → mise run prompts -- --target <target> --context  ← 프로젝트 상태 수집
  → 상태별 판단:
      · AGENTS.md에 pi-prompts 섹션 없음  → suggest 흐름 진입
      · 섹션 있음 + 오래된 마커 감지      → update/compose 제안
      · 섹션 있음 + 최신                  → 현재 구성 요약 출력

# ── 2. 명시적 args ───────────────────────────────────────────────────────────
/pi-workspace:prompts list
  → mise run prompts -- --list

/pi-workspace:prompts preview karpathy
  → mise run prompts -- --preview karpathy

/pi-workspace:prompts install karpathy
  → mise run prompts -- --target <target> --install karpathy

/pi-workspace:prompts install karpathy,owner/repo
  → mise run prompts -- --target <target> --install karpathy,owner/repo

/pi-workspace:prompts suggest
  → mise run prompts -- --target <target> --context
  → 에이전트가 출력을 분석해 적합한 슬러그 추천 + 이유 설명
  → 사용자 확인 후 → install 또는 compose 진행

/pi-workspace:prompts compose
/pi-workspace:prompts compose karpathy
/pi-workspace:prompts compose karpathy,owner/repo
  → mise run prompts -- --target <target> --context
  → mise run prompts -- --preview <slug>  (지정된 슬러그 각각)
  → 에이전트가 프로젝트 컨텍스트 + 템플릿 내용으로 맞춤 합성
  → 결과를 사용자에게 제안 — 확인 전 파일에 쓰지 않는다
  → 승인 후: echo "<합성 내용>" | mise run prompts -- --target <target> --write --section <name>

# ── 3. 자유 요청 ─────────────────────────────────────────────────────────────
/pi-workspace:prompts "<자유 요청>"
  → 의도를 파악해 위 흐름 중 하나로 라우팅한다.

  라우팅 기준:
  · "추천", "뭐가 좋아", "어떤 거 쓸까"          → suggest
  · "합성", "조합", "맞게", "다듬어", "최적화"    → compose (슬러그 명시 시 포함)
  · "추가", "설치", "넣어줘" + 슬러그/레포 명시   → install
  · "보여줘", "내용", "뭐가 있어"                 → preview 또는 list
  · 의도 불명확 → 스마트 모드(--context)로 현황 파악 후 되묻기
```

### suggest / compose 상세 절차

`suggest`와 `compose` args는 **에이전트가 실행하는 흐름**이다. mise task 자체에 AI가 없다.

1. `--context` 플래그로 프로젝트 정보 수집
   - 현재 AGENTS.md 내용 및 기존 설치 섹션
   - `.pi/settings.json` (프로바이더·모델)
   - `package.json` / `.mise.toml` (기술 스택)
   - 카탈로그 목록

2. `compose`에 슬러그가 지정된 경우 `--preview`로 각 템플릿 내용 fetch

3. 에이전트가 컨텍스트를 바탕으로:
   - `suggest`: 적합한 템플릿 추천 + 이유 제시
   - `compose`: 템플릿 섹션 선별·통합, 중복 제거, 프로젝트 특화 규칙 추가

4. 결과를 사용자에게 제안 — **확인 전에 절대 파일에 쓰지 않는다**

5. 사용자 승인 후 task로 기록:
   ```bash
   echo "<합성 내용>" | mise run prompts -- --target <path> --write --section <name>
   ```

### 섹션 마커 형식

```
<!-- pi-prompts:karpathy:start -->
...내용...
<!-- pi-prompts:karpathy:end -->
```

기존 마커가 있으면 교체, 없으면 AGENTS.md 끝에 추가.

## 인터렉션 방식

사용자에게 선택지를 제시할 때 실행 환경에 따라 다음 순서로 도구를 선택한다.

1. `ask_user_question` 도구가 있으면 → **pi 환경** — 해당 도구 사용
2. `AskUserQuestion` 도구가 있으면 → **Claude Code 환경** — 해당 도구 사용
3. 둘 다 없으면 → 텍스트로 선택지 나열 후 응답 대기

환경 이름을 추정하지 않는다. 도구 가용 여부로만 판단한다.

## 금지

- auth.json, API key, .env, 시크릿 생성·복사 금지
- mise, bun, node를 사용자 승인 없이 자동 설치 금지
- mise 없으면 중단하고 안내만 한다
- bun 없으면 스킬 디렉터리의 `mise install bun` 필요성을 설명하고 승인받은 뒤 진행한다
- `--force` 없이 기존 파일 덮어쓰기 금지
- doctor ERROR 상태에서 scaffold 진행 금지
- `/pi-workspace:subagents` 실행 전 pi 인증 여부 반드시 확인
