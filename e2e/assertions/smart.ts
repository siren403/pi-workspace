import { assert, assertEqual, assertIncludes, assertNotIncludes } from "../lib/assert.ts";

interface StatusReport {
  target: {
    manifest: null | { manifestVersion: number; profile: string; templateRevision: string; managedFiles: number };
    drift: { missing: string[]; outOfSync: string[] };
    missingPackages: string[];
    agentOverrides: string[];
  };
  recommendedWorkflow: Array<{ action: string; reason: string }>;
  optionalFollowups: Array<{ action: string; reason: string }>;
  notNeeded: string[];
}

function actions(report: StatusReport): string[] {
  return report.recommendedWorkflow.map((item) => item.action);
}

export function assertNewProject(report: StatusReport): void {
  assert(report.target.manifest === null, "new project: manifest should be missing");
  assertEqual(actions(report).join(" > "), "/pi-workspace:doctor > /pi-workspace:scaffold > /pi-workspace:verify", "new project workflow");
}

export function assertCleanWorkspace(report: StatusReport): void {
  assert(report.target.manifest, "clean workspace: manifest should exist");
  assertEqual(report.target.drift.outOfSync.length, 0, "clean workspace drift");
  assertEqual(actions(report).join(" > "), "/pi-workspace:doctor > /pi-workspace:verify", "clean workspace workflow");
  assertIncludes(report.notNeeded.some((item) => item.startsWith("subagents: configured")) ? ["subagents"] : [], "subagents", "clean workspace not-needed");
}

export function assertDriftedWorkspace(report: StatusReport): void {
  assertIncludes(report.target.drift.outOfSync, ".yolobox.Dockerfile", "drifted workspace drift");
  assertEqual(actions(report).join(" > "), "/pi-workspace:doctor > /pi-workspace:update > /pi-workspace:verify", "drifted workspace workflow");
  assertNotIncludes(actions(report), "/pi-workspace:subagents", "drifted workspace workflow");
  assertIncludes(report.optionalFollowups.map((item) => item.action), "/pi-workspace:prompts suggest", "drifted workspace optional");
}

export function assertStaleManifestWorkspace(report: StatusReport): void {
  assertIncludes(report.target.drift.outOfSync, ".mise/tasks/pi:shell", "stale manifest workspace drift");
  assertIncludes(actions(report), "/pi-workspace:update", "stale manifest workspace workflow");
}

export function assertUpdateIntent(report: StatusReport): void {
  assertIncludes(actions(report), "npx skills add siren403/pi-workspace --full-depth", "update intent workflow");
}

export function assertPiRuntimeUpdateIntent(report: StatusReport): void {
  assertNotIncludes(actions(report), "npx skills add siren403/pi-workspace --full-depth", "pi runtime update should not reinstall skill");
  assertIncludes(actions(report), "mise upgrade --dry-run --local npm:@earendil-works/pi-coding-agent", "pi runtime dry-run workflow");
  assertIncludes(actions(report), "mise upgrade --local npm:@earendil-works/pi-coding-agent", "pi runtime update workflow");
  assertIncludes(actions(report), "mise exec -- pi --version", "pi runtime version check workflow");
  assertIncludes(actions(report), "/pi-workspace:verify", "pi runtime verify workflow");
}

export function assertMissingPackage(report: StatusReport): void {
  assertIncludes(report.target.missingPackages, "npm:pi-subagents", "missing package");
  assertIncludes(actions(report), "/pi-workspace:doctor", "missing package workflow");
  assertIncludes(actions(report), "/pi-workspace:verify", "missing package workflow");
  assertIncludes(actions(report), "mise trust --yes && mise exec -- pi install npm:pi-subagents -l", "missing package recovery workflow");
}
