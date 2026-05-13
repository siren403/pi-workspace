#!/usr/bin/env bun
/**
 * mise run subagents -- --target <path> [--list] [--apply]
 *                        [--main provider/model]
 *                        [--explore provider/model] [--bulk provider/model]
 *                        [--patch provider/model]   [--review provider/model]
 *
 * --list (기본): pi --list-models 파싱 → 메인 모델 현황 + 역할별 후보 출력
 * --apply:       에이전트가 선택한 모델로 글로벌 설정 + agentOverrides + .pi/agents/ 생성
 *
 * 선행 조건: pi 로그인 완료, pi install npm:pi-subagents -l
 */
import { runSubagents } from "./lib/subagents-runner.ts";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target:  { type: "string",  default: "." },
    list:    { type: "boolean", default: false },
    apply:   { type: "boolean", default: false },
    main:    { type: "string" },
    explore: { type: "string" },
    bulk:    { type: "string" },
    patch:   { type: "string" },
    review:  { type: "string" },
  },
});

await runSubagents(values as Parameters<typeof runSubagents>[0]);
