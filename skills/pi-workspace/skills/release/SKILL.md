---
name: pi-workspace-release
description: pi-workspace skill package 릴리즈를 준비하고 검증한다. pi 버전 업데이트, GitHub 기반 skills.sh 배포, e2e 검증, commit/push 전 일관된 release checklist가 필요할 때 사용한다.
---

# Pi Workspace — Release

pi-workspace skill package의 릴리즈를 준비한다. 변경은 작게 묶고, 배포 전 검증을 통과해야 한다.

## 릴리즈 판단

먼저 릴리즈 종류를 분류한다.

| 유형 | 예시 | 기본 처리 |
|------|------|-----------|
| dependency | `pi` 최신 버전 반영 | pin 위치 갱신 + e2e |
| skill behavior | SKILL.md, status, task 로직 변경 | e2e + install-check |
| catalog | pi extension catalog, feature/recipe/profile, scope policy 변경 | catalog-validate + extensions smoke |
| template | scaffold 템플릿 변경 | drift/update e2e |
| release process | 배포/검증 지침 변경 | install-check + remote discovery |
| docs only | README/SKILL 문서 | discovery + diff check |

## Distribution Policy

- 배포 채널은 GitHub repository `siren403/pi-workspace`의 `main` 브랜치다.
- 사용자는 `npx skills add siren403/pi-workspace --full-depth`로 설치/갱신한다.
- npm은 `npx skills` 실행 수단일 뿐, `pi-workspace` 배포 채널로 사용하지 않는다.
- registry 배포, registry dry-run, package version bump를 릴리즈 절차에 포함하지 않는다.

## Version Policy

- `@earendil-works/pi-coding-agent`는 재현성을 위해 명시 버전 pin을 우선한다.
- 최신 버전 확인:
  ```bash
  npm view @earendil-works/pi-coding-agent version
  ```
- pi 버전 변경 시 함께 확인할 위치:
  ```bash
  rg -n "pi-coding-agent|@earendil-works/pi|0\\.[0-9]+\\.[0-9]+" . skills/pi-workspace
  ```
- 최소 버전 정책(`pi >= 0.70`)은 doctor 문서와 체크 로직이 일치해야 한다.

## Workflow

1. 릴리즈 범위 확인
   ```bash
   git status --short --branch
   git log -1 --oneline
   ```

2. 외부 최신 버전 확인이 필요한 경우 조회
   ```bash
   npm view @earendil-works/pi-coding-agent version
   ```

3. 필요한 파일만 수정
   - root `.mise.toml`
   - `skills/pi-workspace/templates/scaffold/.mise.toml`
   - `skills/pi-workspace/templates/scaffold/.yolobox.Dockerfile`
   - `skills/pi-workspace/SKILL.md`
   - `skills/pi-workspace/README.md`
   - `skills/pi-workspace/skills/*/SKILL.md`
   - `skills/pi-workspace/.mise/tasks/extensions.ts`
   - `skills/pi-workspace/.mise/tasks/lib/extensions-catalog.ts`
   - `.github/**`

4. 검증 실행
   ```bash
   mise run skill:catalog-validate
   cd skills/pi-workspace && mise run extensions -- --list
   mise run e2e:smart
   mise run e2e:cold-start
   mise run skill:install-check
   npx skills add ./skills/pi-workspace --list --full-depth
   env PATH="$HOME/.local/bin:/usr/bin:/bin" MISE_DATA_DIR=/tmp/pi-workspace-mise-empty MISE_AUTO_INSTALL=0 mise run status -- --target /tmp
   git diff --check
   ```

   cold-start 검증은 `status`가 cryptic shebang 오류 대신 `bun is required` bootstrap 안내를 출력하는지 확인한다. 이 명령은 실패 exit가 정상일 수 있으며, 메시지를 확인한다.

5. 실제 agent e2e는 opt-in으로만 실행
   ```bash
   PI_WORKSPACE_E2E_AGENT=1 mise run e2e:agent -- --agent pi
   ```
   provider/auth/quota 문제는 transcript로 기록하고, `PI_WORKSPACE_E2E_STRICT=1`이 아니면 release blocker로 보지 않는다.

6. 배포
   - 검증 통과 후 commit + push로 GitHub `main`에 반영한다.
   - 별도 요청이 없으면 tag나 registry 배포를 만들지 않는다.

7. 원격 skills.sh 검증
   ```bash
   npx skills add siren403/pi-workspace --list --full-depth
   ```

8. 사용자 업데이트 안내
   ```bash
   npx skills add siren403/pi-workspace --full-depth
   /pi-workspace
   ```

## Stop Conditions

- `e2e:smart`, `e2e:cold-start`, `skill:install-check`, `git diff --check` 실패
- `skill:catalog-validate` 실패 또는 extension profile/recipe 추천이 자동 설치·삭제로 동작
- skills.sh full-depth discovery에서 예상 subskill 누락
- managed template 변경이 있는데 drift/update e2e가 깨짐
- release 작업이 registry 배포를 요구하는 방향으로 흐름
- release 범위와 무관한 파일 변경 발견

## Output

릴리즈 준비 결과는 다음 순서로 보고한다.

1. 변경 범위
2. 버전 변경 사항
3. 실행한 검증과 결과
4. 남은 승인 필요 작업
5. 사용자가 실행할 업데이트 명령
