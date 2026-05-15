import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { AgentTurn } from "../adapters/types.ts";

export interface Transcript {
  agent: string;
  scenario: string;
  projectDir: string;
  turns: AgentTurn[];
}

export async function writeTranscript(transcript: Transcript): Promise<string> {
  const base = resolve(process.env.PI_WORKSPACE_E2E_TRANSCRIPTS ?? ".e2e/transcripts");
  const path = join(base, `${transcript.scenario}-${transcript.agent}-${Date.now()}.json`);
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, JSON.stringify(transcript, null, 2) + "\n");
  return path;
}
