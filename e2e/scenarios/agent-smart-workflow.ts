import { getAdapter } from "../adapters/index.ts";
import type { AgentTurn } from "../adapters/types.ts";
import { assert, assertIncludes, assertNotIncludes } from "../lib/assert.ts";
import { writeTranscript } from "../lib/transcript.ts";
import { driftedWorkspaceFixture } from "../fixtures/workspace.ts";

const SKILL_SOURCE = new URL("../../skills/pi-workspace/", import.meta.url).pathname;

function text(turns: Array<{ stdout: string; stderr: string }>): string {
  return turns.map((turn) => `${turn.stdout}\n${turn.stderr}`).join("\n");
}

function isProviderBlocked(output: string): boolean {
  return output.includes("usage_limit_reached") || output.includes("429") || output.includes("API key") || output.includes("rate limit");
}

async function handleBlocked(agentName: string, fixtureTarget: string, turns: AgentTurn[]): Promise<boolean> {
  if (!isProviderBlocked(text(turns))) return false;
  const transcriptPath = await writeTranscript({
    agent: agentName,
    scenario: "smart-workflow-blocked",
    projectDir: fixtureTarget,
    turns,
  });
  console.log(`[e2e:agent] blocked by provider/auth limits; transcript: ${transcriptPath}`);
  if (process.env.PI_WORKSPACE_E2E_STRICT === "1") {
    throw new Error("agent e2e blocked by provider/auth limits");
  }
  return true;
}

export async function runAgentSmartWorkflow(agentName: string): Promise<void> {
  const adapter = getAdapter(agentName);
  const fixture = await driftedWorkspaceFixture();
  const turns: AgentTurn[] = [];

  try {
    await adapter.installSkill(fixture.target, SKILL_SOURCE);

    turns.push(await adapter.start(
      fixture.target,
      "pi-workspace 스마트 모드로 현재 프로젝트를 작업 가능한 상태로 만들기 위해 필요한 것만 정리해줘. 파일은 아직 변경하지 말고, 승인하면 Recommended workflow를 한 번에 이어서 진행할 수 있게 요약해줘.",
    ));
    if (await handleBlocked(adapter.name, fixture.target, turns)) return;
    assert(turns[0].exitCode === 0, `${agentName} first turn failed`);
    assertIncludes(text(turns), "/pi-workspace:update", "agent first turn");
    assertNotIncludes(text(turns), "/pi-workspace:subagents\n", "agent first turn");

    turns.push(await adapter.continue(
      fixture.target,
      "승인. 방금 제안한 Recommended workflow를 이어서 진행해줘. 표시한 managed update 범위 안에서는 적용해도 되고, doctor ERROR가 있으면 중단해줘.",
    ));
    if (await handleBlocked(adapter.name, fixture.target, turns)) return;
    assert(turns[1].exitCode === 0, `${agentName} approval turn failed`);
    assertIncludes(text(turns), "verify", "agent approval turn");

    turns.push(await adapter.continue(
      fixture.target,
      "이제 더 해야 할 거 있어? 작업 가능한 상태면 필수/선택을 구분해서 짧게 말해줘. 파일 변경은 하지마.",
    ));
    if (await handleBlocked(adapter.name, fixture.target, turns)) return;
    assert(turns[2].exitCode === 0, `${agentName} final turn failed`);
    assertIncludes(text(turns), "필수", "agent final turn");

    const transcriptPath = await writeTranscript({
      agent: adapter.name,
      scenario: "smart-workflow",
      projectDir: fixture.target,
      turns,
    });
    console.log(`[e2e:agent] transcript: ${transcriptPath}`);
  } finally {
    await fixture.cleanup();
  }
}
