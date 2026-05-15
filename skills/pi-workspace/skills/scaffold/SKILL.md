---
name: pi-workspace-scaffold
description: YoloBox + Pi + mise workspace를 새 프로젝트에 생성한다. doctor → scaffold → verify 순서로 실행하며 ERROR 시 중단한다.
---

# Pi Workspace — Scaffold

새 프로젝트에 YoloBox + Pi + mise agent workspace를 생성한다.

## 실행 규칙

**에이전트는 파일을 직접 작성하지 않는다.** 모든 파일 생성은 mise 태스크가 수행한다.

```bash
cd .pi/skills/pi-workspace   # 또는 .agents/skills/pi-workspace
mise trust                   # 새 설치 경로에서는 최초 1회 필요
```

## 플로우

1. **doctor** 실행 → 결과 보고
   ```bash
   mise run doctor -- --target <path>
   ```
2. ERROR 있으면 중단. 사용자가 수정 후 재실행 요청할 때까지 대기.
3. WARN은 사용자에게 안내 후 진행 여부 확인.
4. 모두 OK → **scaffold** 실행
   ```bash
   mise run scaffold -- --target <path>
   ```
5. scaffold 완료 후 **verify** 실행
   ```bash
   mise run verify -- --target <path>
   ```
6. 결과 요약 + 후속 안내:
   - 확장 설치: `/pi-workspace:extensions`
   - 서브에이전트 구성: `/pi-workspace:subagents`
   - pi 실행: `mise run pi`

## 생성 파일

```
.yolobox.toml           — YoloBox 샌드박스 설정
.yolobox.Dockerfile     — pi 사전 설치 이미지
.mise.toml              — 도구 버전 + 태스크 단축키
AGENTS.md               — 프로젝트 에이전트 지침
.mise/tasks/pi          — pi 세션 시작 (YoloBox)
.mise/tasks/pi:fork     — 폴더 격리 환경 실행
.mise/tasks/pi:shell    — 비대화형 검증용 셸
```

## 금지

- doctor ERROR 상태에서 scaffold 진행 금지
- `--force` 없이 기존 파일 덮어쓰기 금지
- mise, bun, node 자동 설치 금지
