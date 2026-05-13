---
name: pi-workspace
description: YoloBox + Pi + mise agent workspace를 관리한다. 초기화·검증·갱신·서브에이전트 구성·확장 설치를 담당. 파일을 직접 작성하지 말고 반드시 mise 태스크를 실행한다.
---

# Pi Workspace

YoloBox + Pi + mise 기반 agent workspace를 새 프로젝트에 생성하거나 기존 workspace를 갱신·검증·설정한다.

## 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/pi-workspace:scaffold` | 새 프로젝트에 workspace 생성 |
| `/pi-workspace:subagents` | 인증된 프로바이더 기반 서브에이전트 구성 |
| `/pi-workspace:extensions` | pi 확장 패키지 카탈로그 조회·선택 설치 |
| `/pi-workspace:verify` | workspace 무결성 검증 |
| `/pi-workspace:update` | managedFiles 갱신 |
| `/pi-workspace:doctor` | 환경 상태만 확인 |

## 기본 동작 `/pi-workspace`

서브커맨드 없이 호출되면 doctor를 실행하고 현재 상태에 따라 다음 단계를 제안한다.

```bash
cd .pi/skills/pi-workspace && mise run doctor -- --target <target>
```

상태별 제안:
- `.agent-workspace.json` 없음 → `/pi-workspace:scaffold` 안내
- workspace 있음 + agentOverrides 없음 + pi-subagents 설치됨 → `/pi-workspace:subagents` 안내
- workspace 있음 + 설정 완료 → 현재 구성 요약 출력
- doctor ERROR → 오류 항목과 수정 방법 안내 후 종료

## 실행 규칙

**에이전트는 파일을 직접 작성하지 않는다.**

모든 파일 생성·갱신은 이 스킬의 mise 태스크가 수행한다.

스킬 디렉토리에서 실행:
```bash
cd .pi/skills/pi-workspace

mise run doctor -- --target <path>
mise run scaffold -- --target <path>
mise run subagents -- --target <path>
mise run extensions -- --target <path>
mise run extensions -- --target <path> --install context-mode,pi-lens
mise run verify -- --target <path>
mise run update -- --target <path>
```

## /pi-workspace:scaffold 플로우

1. **doctor** 실행 → 결과 사용자에게 보고
2. ERROR 있으면 중단. 사용자가 수정 후 재실행 요청할 때까지 대기.
3. WARN은 사용자에게 안내 후 진행 여부 확인.
4. 모두 OK → **scaffold** 실행
5. scaffold 완료 후 **verify** 실행
6. 결과 요약 보고 + extensions·subagents 후속 안내

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

## 금지

- auth.json, API key, .env, 시크릿 생성·복사 금지
- mise, bun, node 자동 설치 금지 (mise 없으면 중단하고 안내만)
- `--force` 없이 기존 파일 덮어쓰기 금지
- doctor ERROR 상태에서 scaffold 진행 금지
- `/pi-workspace:subagents` 실행 전 pi 인증 여부 반드시 확인
