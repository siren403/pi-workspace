import { $ } from "bun";
import type { AgentAdapter, AgentTurn } from "./types.ts";

async function turn(projectDir: string, prompt: string, args: string[]): Promise<AgentTurn> {
  const result = await $`pi ${args} ${prompt}`.cwd(projectDir).nothrow();
  return {
    prompt,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

export const piAdapter: AgentAdapter = {
  name: "pi",

  async installSkill(projectDir: string, skillSource: string): Promise<void> {
    await $`npx skills add ${skillSource} --full-depth --skill pi-workspace --agent pi -y --copy`.cwd(projectDir);
    await $`mise trust --yes`.cwd(`${projectDir}/.pi/skills/pi-workspace`).quiet().nothrow();
  },

  async start(projectDir: string, prompt: string): Promise<AgentTurn> {
    return turn(projectDir, prompt, ["--skill", ".pi/skills/pi-workspace", "-p"]);
  },

  async continue(projectDir: string, prompt: string): Promise<AgentTurn> {
    return turn(projectDir, prompt, ["-c", "-p"]);
  },
};
