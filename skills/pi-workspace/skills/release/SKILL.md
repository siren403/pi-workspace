---
name: pi-workspace-release
description: pi-workspace skill package 릴리즈를 준비하고 검증한다. pi 버전 업데이트, skills.sh 배포, npm publish, e2e 검증, commit/tag/push 전 일관된 release checklist가 필요할 때 사용한다.
---

# Pi Workspace — Release

pi-workspace skill package의 릴리즈를 준비한다. 변경은 작게 묶고, 배포 전 검증을 통과해야 한다.

## 릴리즈 판단

먼저 릴리즈 종류를 분류한다.

| 유형 | 예시 | 기본 처리 |
|------|------|-----------|
| dependency | `pi` 최신 버전 반영 | pin 위치 갱신 + e2e |
| skill behavior | SKILL.md, status, task 로직 변경 | e2e + install-check |
| template | scaffold 템플릿 변경 | drift/update e2e |
| npm package | npm 배포 필요 | package version bump + dry-run |
| docs only | README/SKILL 문서 | discovery + dry-run |

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
   - root `package.json` only when npm publish version changes

4. 검증 실행
   ```bash
   mise run e2e:smart
   mise run skill:install-check
   npx skills add ./skills/pi-workspace --list --full-depth
   env PATH="$HOME/.local/bin:/usr/bin:/bin" MISE_DATA_DIR=/tmp/pi-workspace-mise-empty MISE_AUTO_INSTALL=0 mise run status -- --target /tmp
   npm publish --dry-run
   git diff --check
   ```

   cold-start 검증은 `status`가 cryptic shebang 오류 대신 `bun is required` bootstrap 안내를 출력하는지 확인한다. 이 명령은 실패 exit가 정상일 수 있으며, 메시지를 확인한다.

5. 실제 agent e2e는 opt-in으로만 실행
   ```bash
   PI_WORKSPACE_E2E_AGENT=1 mise run e2e:agent -- --agent pi
   ```
   provider/auth/quota 문제는 transcript로 기록하고, `PI_WORKSPACE_E2E_STRICT=1`이 아니면 release blocker로 보지 않는다.

6. npm 배포 여부 결정
   - GitHub skills.sh 배포만 필요하면 commit + push
   - npm 배포가 필요하면 root `package.json` version bump 후 `npm publish --dry-run`, 승인 후 `npm publish`

7. 원격 검증
   ```bash
   npx skills add siren403/pi-workspace --list --full-depth
   ```

8. 사용자 업데이트 안내
   ```bash
   npx skills add siren403/pi-workspace --full-depth
   /pi-workspace
   ```

## Stop Conditions

- `e2e:smart`, `skill:install-check`, `npm publish --dry-run`, `git diff --check` 실패
- skills.sh full-depth discovery에서 예상 subskill 누락
- managed template 변경이 있는데 drift/update e2e가 깨짐
- npm publish가 필요한데 package version을 올리지 않음
- release 범위와 무관한 파일 변경 발견

## Output

릴리즈 준비 결과는 다음 순서로 보고한다.

1. 변경 범위
2. 버전 변경 사항
3. 실행한 검증과 결과
4. 남은 승인 필요 작업
5. 사용자가 실행할 업데이트 명령
