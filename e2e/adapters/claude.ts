import type { AgentAdapter } from "./types.ts";

export const claudeAdapter: AgentAdapter = {
  name: "claude",
  async installSkill(): Promise<void> {
    throw new Error("claude adapter is not implemented yet");
  },
  async start(): Promise<never> {
    throw new Error("claude adapter is not implemented yet");
  },
  async continue(): Promise<never> {
    throw new Error("claude adapter is not implemented yet");
  },
};
