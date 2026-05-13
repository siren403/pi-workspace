# Agent Rules

## 실행 환경

이 프로젝트는 YoloBox + Pi + mise 기반 agent workspace입니다.

```bash
mise run pi              # pi 세션 시작 (기본)
mise run pi:fork         # 폴더 격리 환경에서 실행
mise run pi:fork -- feature-name  # 이름 지정
mise run pi:shell -- list         # 비대화형 검증
```

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
