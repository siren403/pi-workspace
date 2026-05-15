export interface AgentTurn {
  prompt: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface AgentAdapter {
  name: string;
  installSkill(projectDir: string, skillSource: string): Promise<void>;
  start(projectDir: string, prompt: string): Promise<AgentTurn>;
  continue(projectDir: string, prompt: string): Promise<AgentTurn>;
}
