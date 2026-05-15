---
name: pi-workspace-doctor
description: pi-workspace 환경 상태를 점검한다. mise, pi, YoloBox, pi 인증, 타겟 쓰기 권한, 시크릿 노출 여부를 확인하고 결과를 보고한다.
---

# Pi Workspace — Doctor

환경 상태를 점검하고 문제가 있으면 수정 방법을 안내한다.

## 실행

```bash
cd .pi/skills/pi-workspace   # 또는 .agents/skills/pi-workspace
mise trust                   # 새 설치 경로에서는 최초 1회 필요
mise run doctor -- --target <path>
```

## 점검 항목

| 항목 | 설명 |
|------|------|
| `mise` | mise 설치 여부 |
| `pi` | pi CLI 설치 여부 |
| `pi-version` | pi ≥ 0.70 여부 |
| `yolobox` | YoloBox 설치 여부 |
| `auth` | pi 인증 상태 |
| `target-writable` | 타겟 디렉토리 쓰기 가능 여부 |
| `no-secret` | `.pi/auth.json` 등 시크릿 커밋 여부 |

## 결과 처리

- **OK** → 다음 단계 진행
- **WARN** → 사용자에게 안내 후 진행 여부 확인
- **ERROR** → 수정 방법 안내 후 중단. 사용자가 수정하면 재실행.

## 연계 동작

doctor 결과에 따라 다음을 제안한다:

- `.agent-workspace.json` 없음 → `/pi-workspace:scaffold`
- workspace 있음 + agentOverrides 없음 → `/pi-workspace:subagents`
- workspace 있음 + 설정 완료 → 현재 구성 요약 출력
