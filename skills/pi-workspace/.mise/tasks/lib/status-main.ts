/**
 * mise run status -- --target <path> [--intent <user request>]
 * Smart-mode 상태 수집. 파일을 변경하지 않고 다음 실행 계획을 출력한다.
 */
import { parseArgs } from "node:util";
import { runStatus } from "./status-runner.ts";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target: { type: "string", default: "." },
    intent: { type: "string", default: "" },
    json: { type: "boolean", default: false },
  },
});

await runStatus(values.target!, values.intent ?? "", values.json ?? false);
