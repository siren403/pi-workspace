/**
 * mise run doctor -- --target <path>
 * 환경 검증. ERROR 있으면 exit 1, WARN만 있으면 exit 0.
 */
import { runDoctor } from "./checks.ts";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { target: { type: "string", default: "." } },
});

const exit = await runDoctor(values.target!);
process.exit(exit);
