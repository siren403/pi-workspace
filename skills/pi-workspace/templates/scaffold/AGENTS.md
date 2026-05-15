# Agent Rules

## 실행 환경

이 프로젝트는 YoloBox + Pi + mise 기반 agent workspace입니다.

```bash
mise run pi              # pi 세션 시작 (기본)
mise run pi -- -c        # 이전 pi 세션 계속하기
mise run pi:fork         # 폴더 격리 환경에서 실행
mise run pi:fork -- feature-name  # 이름 지정
mise run pi:shell -- list         # 비대화형 검증
```

비대화형 agent/tool shell에서 `node`, `npm`, `pi install`을 직접 실행해야 하면
프로젝트의 `.mise.toml` 런타임을 사용하도록 `mise exec -- <command>`로 감싼다.
예: `mise exec -- node -v`, `mise exec -- pi install npm:pi-subagents -l`.

> **pi-workspace 스킬 태스크** (scaffold, subagents, prompts 등)는 프로젝트 루트가 아닌
> 스킬 디렉토리에서 실행해야 합니다:
> ```bash
> cd .agents/skills/pi-workspace   # 또는 .pi/skills/pi-workspace
> mise run subagents -- --target <project>
> ```

## 서브에이전트

pi-subagents가 설치된 경우 서브에이전트를 활용합니다.

| 에이전트 | 사용 시점 |
|----------|-----------|
| `explore` | 모르는 코드베이스 탐색, 관련 파일 위치 파악 |
| `bulk` | 대량 코드·로그 요약, 변경 영향 분석 |
| `patch` | 명확히 승인된 단순 패치 적용 |
| `review` | 릴리즈 전, 인증·결제·데이터 관련 변경 최종 검토 |

```
# 예시
Use explore to find all authentication middleware
Use patch to fix the typo in config.ts line 42
Use review to review the changes in auth.ts
```

### review 서브에이전트 가드레일

**사용해야 할 때**: 릴리즈 게이트, 인증·결제·개인정보 처리 변경, 대규모 리팩터링.

**직접 diff/테스트로 충분한 경우 (review 불필요)**:
- 셸 스크립트, 템플릿, 문서 등 소규모 패치
- 이미 검증된 단순 오타·포맷 수정

**오작동 시 규칙**:
- 서브에이전트 출력이 TUI 이스케이프 시퀀스 등 판독 불가 형태면 즉시 중단하고 직접 검증으로 대체한다. 재시도하지 않는다.
- review를 1회 실행했으나 결과가 불명확하면 사용자에게 확인 후 재시도한다. 자동 재시도 금지.

**컨텍스트 불일치 경고**:
- 현재 활성 프로젝트와 수정 대상 저장소가 다를 경우 review 서브에이전트 호출 전에 사용자에게 명시적으로 알린다.

## 안전 규칙

- `.env`, 시크릿, 자격증명, API 키를 읽거나 출력하지 않는다.
- `auth.json`을 프로젝트에 복사하지 않는다.
- docker, kubectl, 클라우드 CLI, ssh, 프로덕션 서비스는 명시적 요청이 없으면 사용하지 않는다.
- 메타데이터 엔드포인트(`169.254.169.254` 등)에 접근하지 않는다.
- 관련 없는 파일을 수정하지 않는다.

## 워크플로

- 변경 전 수정할 파일과 범위를 먼저 설명한다.
- 파괴적 변경은 사용자 확인 후 진행한다.
- 변경 후 diff와 실행한 테스트를 요약한다.
- 작고 검토 가능한 단위로 패치한다.
