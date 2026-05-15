import { claudeAdapter } from "./claude.ts";
import { codexAdapter } from "./codex.ts";
import { piAdapter } from "./pi.ts";
import type { AgentAdapter } from "./types.ts";

const adapters: Record<string, AgentAdapter> = {
  pi: piAdapter,
  codex: codexAdapter,
  claude: claudeAdapter,
};

export function getAdapter(name: string): AgentAdapter {
  const adapter = adapters[name];
  if (!adapter) throw new Error(`Unknown e2e agent adapter: ${name}`);
  return adapter;
}
