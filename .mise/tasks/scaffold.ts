#!/usr/bin/env bun
/**
 * mise run scaffold -- --target <path> [--force] [--check] [--diff] [--install]
 * doctor 통과 후 workspace 파일 생성 + pi install -l 실행.
 */
import { runDoctor } from "./lib/checks.ts";
import { runScaffold } from "./lib/scaffold-runner.ts";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target:  { type: "string",  default: "." },
    force:   { type: "boolean", default: false },
    check:   { type: "boolean", default: false },
    diff:    { type: "boolean", default: false },
    install: { type: "boolean", default: false },
  },
});

const doctorExit = await runDoctor(values.target!);
if (doctorExit !== 0) {
  console.error("\n[scaffold] Doctor reported errors. Fix them and retry.");
  process.exit(1);
}

await runScaffold(values as Parameters<typeof runScaffold>[0]);
