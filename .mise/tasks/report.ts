#!/usr/bin/env bun
/**
 * mise run report -- [options]
 *
 * --context              환경·doctor 정보 수집 출력 (에이전트 진입점)
 * --target <path>        대상 프로젝트 (기본: .)
 * --submit               gh issue create로 직접 제출
 * --url                  pre-filled GitHub 이슈 URL 출력
 * --title <string>       이슈 제목
 * --body <string>        이슈 본문 (에러 설명)
 */
import { runReport } from "./lib/report-runner.ts";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target:  { type: "string",  default: "." },
    context: { type: "boolean", default: false },
    submit:  { type: "boolean", default: false },
    url:     { type: "boolean", default: false },
    title:   { type: "string" },
    body:    { type: "string" },
  },
});

await runReport(values as Parameters<typeof runReport>[0]);
