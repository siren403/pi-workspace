---
name: pi-workspace-update
description: 기존 pi-workspace의 managed files를 최신 템플릿과 동기화한다. 변경 전 diff를 보여주고 사용자 승인 후 갱신한 뒤 verify를 실행한다.
---

# Pi Workspace — Update

기존 workspace의 managed files를 최신 템플릿 기준으로 갱신한다.

`.agent-workspace.json`은 마지막 적용 상태 기록이다. update는 이 파일만 신뢰하지 않고 현재 skill의 `templates/scaffold` tree를 함께 열거한다.
갱신 성공 후 `.agent-workspace.json`의 `manifestVersion`, `template.revision`, `managedFiles`를 normalize한다. 템플릿에서 사라진 legacy file은 자동 삭제하지 않는다.

## 실행 규칙

**에이전트는 파일을 직접 작성하지 않는다.** 모든 파일 갱신은 mise 태스크가 수행한다.

```bash
cd .pi/skills/pi-workspace   # 또는 .agents/skills/pi-workspace
mise trust --yes             # 새 설치 경로에서는 최초 1회 필요
```

## 플로우

1. 변경 전 diff 확인
   ```bash
   mise run update -- --target <path> --diff
   ```
2. 사용자에게 변경 파일과 영향 요약
3. 사용자가 현재 diff에 대한 managed update를 승인하면 갱신
   ```bash
   mise run update -- --target <path> --force
   ```
4. 갱신 후 verify
   ```bash
   mise run verify -- --target <path>
   ```

## 금지

- diff 확인 없이 `--force` 실행 금지
- managed files 밖의 파일 직접 수정 금지
- 사용자 승인 없이 drift를 덮어쓰기 금지
