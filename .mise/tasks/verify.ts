#!/usr/bin/env bun
/**
 * mise run verify -- --target <path>
 * 필수 파일 존재·금지 파일 부재·pi 패키지 등록 여부 검사.
 */
import { runVerify } from "./lib/verify-runner.ts";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { target: { type: "string", default: "." } },
});

const ok = await runVerify(values.target!);
process.exit(ok ? 0 : 1);
