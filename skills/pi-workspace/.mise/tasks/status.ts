#!/usr/bin/env bun
/**
 * mise run status -- --target <path> [--intent <user request>]
 * Smart-mode 상태 수집. 파일을 변경하지 않고 다음 실행 계획을 출력한다.
 */
import { parseArgs } from "node:util";
import { runStatus } from "./lib/status-runner.ts";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target: { type: "string", default: "." },
    intent: { type: "string", default: "" },
  },
});

await runStatus(values.target!, values.intent ?? "");
