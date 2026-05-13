#!/usr/bin/env bun
/**
 * mise run prompts -- [options]
 *
 * --list                         카탈로그 출력 (기본)
 * --preview <slug|owner/repo>    내용 미리보기
 * --target <path>                대상 프로젝트 (기본: .)
 * --install <slug,...>           AGENTS.md에 섹션 주입
 * --source <owner/repo>          카탈로그 외 레포 직접 지정 (--install과 조합 가능)
 * --force                        기존 섹션 강제 덮어쓰기
 *
 * [에이전트 합성 모드]
 * echo "<content>" | mise run prompts -- --target <path> --write --section <name>
 */
import { runPrompts } from "./lib/prompts-runner.ts";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target:  { type: "string",  default: "." },
    list:    { type: "boolean", default: false },
    preview: { type: "string" },
    install: { type: "string" },
    source:  { type: "string" },
    write:   { type: "boolean", default: false },
    section: { type: "string" },
    force:   { type: "boolean", default: false },
  },
});

await runPrompts(values as Parameters<typeof runPrompts>[0]);
