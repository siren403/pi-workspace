---
name: pi-workspace-report
description: pi-workspace 사용 중 발생한 이슈를 GitHub에 리포팅한다. 환경 정보와 doctor 결과를 자동 수집해 이슈 초안을 생성하거나 직접 제출한다.
---

# Pi Workspace — Report

pi-workspace 사용 중 버그나 문제를 GitHub 이슈로 리포팅한다.

## 실행 규칙

에이전트는 파일을 직접 작성하지 않는다. 이슈 제출은 mise 태스크가 수행한다.

```bash
cd .agents/skills/pi-workspace   # 또는 .pi/skills/pi-workspace
```

## 플로우

1. 환경·doctor 정보 수집
   ```bash
   mise run report -- --target <path> --context
   ```

2. 사용자에게 에러 상황 확인
   - `ask_user_question` 있음 → pi 환경 — 해당 도구 사용
   - `AskUserQuestion` 있음 → Claude Code — 해당 도구 사용
   - 둘 다 없음 → 텍스트로 질문

   물어볼 내용:
   - 이슈 제목 (한 줄 요약)
   - 재현 절차 / 에러 메시지

3. gh 인증 여부에 따라 분기:
   - `gh auth status` 성공 → 직접 제출
     ```bash
     mise run report -- --target <path> --submit \
       --title "제목" --body "설명"
     ```
   - gh 없거나 미인증 → pre-filled URL 출력
     ```bash
     mise run report -- --target <path> --url \
       --title "제목" --body "설명"
     ```

4. 결과 사용자에게 전달
   - 직접 제출 시: 생성된 이슈 URL 안내
   - URL 출력 시: 브라우저에서 열도록 안내

## 이슈 트래커

https://github.com/siren403/pi-workspace/issues
