---
name: pi-workspace-verify
description: 생성된 pi-workspace가 정상인지 검증한다. manifest, managed files, pi package 등록, gitignore, 실행 권한, 시크릿 노출 여부를 확인한다.
---

# Pi Workspace — Verify

기존 workspace의 무결성을 검증한다. 파일을 변경하지 않는다.

## 실행 규칙

**에이전트는 파일을 직접 작성하지 않는다.** 검증은 mise 태스크가 수행한다.

```bash
cd .pi/skills/pi-workspace   # 또는 .agents/skills/pi-workspace
mise trust --yes             # 새 설치 경로에서는 최초 1회 필요
mise run verify -- --target <path>
```

## 결과 처리

- **0 errors / 0 warnings** → 작업 가능한 상태
- **WARN** → 사용자에게 영향과 후속 선택지를 설명
- **ERROR** → 수정 방법 안내 후 중단. 필요한 경우 `/pi-workspace:update` 또는 `/pi-workspace:scaffold`를 제안

## Template Drift 처리

`verify` 결과에 다음 형태의 managed file/template drift가 있으면 `/pi-workspace:update` 플로우로 전환한다.

```text
[file:<path>] <path> differs from current template
→ Run /pi-workspace:update to review and refresh managed files
```

전환 순서:

1. 변경 전 diff 확인
   ```bash
   mise run update -- --target <path> --diff
   ```
2. 사용자에게 적용 대상과 영향을 요약하고 승인받기
3. 승인 후 managed file 갱신
   ```bash
   mise run update -- --target <path> --force
   ```
4. 다시 verify
   ```bash
   mise run verify -- --target <path>
   ```

이 경우도 `verify` 자체는 파일을 수정하지 않는다. 실제 적용은 승인된 `/pi-workspace:update`가 수행한다.

## 금지

- verify 중 파일 수정 금지
- ERROR 상태를 숨기고 후속 변경 진행 금지
