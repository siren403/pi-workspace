#!/usr/bin/env bun
/**
 * mise run update -- --target <path> [--force] [--diff]
 * .agent-workspace.json 기반 managedFiles만 갱신.
 */
import { runUpdate } from "./lib/update-runner.ts";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target: { type: "string",  default: "." },
    force:  { type: "boolean", default: false },
    diff:   { type: "boolean", default: false },
  },
});

await runUpdate(values as Parameters<typeof runUpdate>[0]);
