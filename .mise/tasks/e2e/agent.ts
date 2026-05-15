#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { runAgentSmartWorkflow } from "../../../e2e/scenarios/agent-smart-workflow.ts";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    agent: { type: "string", default: "pi" },
  },
});

if (process.env.PI_WORKSPACE_E2E_AGENT !== "1") {
  console.log("[e2e:agent] skipped. Set PI_WORKSPACE_E2E_AGENT=1 to run real agent e2e.");
  process.exit(0);
}

if (values.agent !== "pi") {
  console.log(`[e2e:agent] ${values.agent} adapter is not implemented yet.`);
  process.exit(0);
}

await runAgentSmartWorkflow(values.agent);
