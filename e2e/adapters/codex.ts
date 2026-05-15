import type { AgentAdapter } from "./types.ts";

export const codexAdapter: AgentAdapter = {
  name: "codex",
  async installSkill(): Promise<void> {
    throw new Error("codex adapter is not implemented yet");
  },
  async start(): Promise<never> {
    throw new Error("codex adapter is not implemented yet");
  },
  async continue(): Promise<never> {
    throw new Error("codex adapter is not implemented yet");
  },
};
