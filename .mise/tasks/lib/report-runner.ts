import { resolve } from "path";
import { $ } from "bun";
import { runDoctor } from "./checks.ts";

const REPO = "siren403/pi-workspace";
const ISSUES_URL = `https://github.com/${REPO}/issues/new`;

// ─── 환경 정보 수집 ──────────────────────────────────────────────────────────

async function collectEnv(): Promise<string> {
  const lines: string[] = [];

  const ver = async (cmd: string) => {
    const r = await $`${cmd}`.quiet().nothrow();
    const out = (r.stdout.toString() || r.stderr.toString()).trim();
    return r.exitCode === 0 ? out.split("\n")[0] : "not found";
  };

  lines.push(`- mise: ${await ver("mise --version")}`);
  lines.push(`- pi: ${await ver("mise exec -- pi --version")}`);
  lines.push(`- yolobox: ${await ver("yolobox --version")}`);
  lines.push(`- bun: ${await ver("bun --version")}`);
  lines.push(`- OS: ${(await ver("uname -sr"))}`);

  return lines.join("\n");
}

// ─── doctor 요약 ─────────────────────────────────────────────────────────────

async function collectDoctor(target: string): Promise<string> {
  // runDoctor은 console.log로 직접 출력하므로 캡처용으로 재구현
  const checks = [
    { cmd: "mise --version",           name: "mise"      },
    { cmd: "mise exec -- pi --version", name: "pi"        },
    { cmd: "yolobox --version",        name: "yolobox"   },
  ];
  const rows: string[] = [];
  for (const { cmd, name } of checks) {
    const r = await $`${cmd}`.quiet().nothrow();
    rows.push(`- ${name}: ${r.exitCode === 0 ? "✓" : "✗"}`);
  }
  const auth = await Bun.file(`${process.env.HOME}/.pi/agent/auth.json`).exists();
  rows.push(`- pi-auth: ${auth ? "✓" : "✗"}`);
  return rows.join("\n");
}

// ─── gh 인증 여부 ─────────────────────────────────────────────────────────────

async function ghAuthed(): Promise<boolean> {
  const r = await $`gh auth status`.quiet().nothrow();
  return r.exitCode === 0;
}

// ─── 이슈 본문 생성 ──────────────────────────────────────────────────────────

function buildBody(env: string, doctor: string, description: string): string {
  return `## 설명

${description}

## 환경

${env}

## Doctor 요약

${doctor}
`;
}

// ─── pre-filled URL ───────────────────────────────────────────────────────────

function buildUrl(title: string, body: string): string {
  const params = new URLSearchParams({ title, body });
  return `${ISSUES_URL}?${params.toString()}`;
}

// ─── options ─────────────────────────────────────────────────────────────────

export interface ReportOptions {
  target: string;
  context: boolean;   // 환경 정보만 출력 (에이전트가 읽어서 이슈 작성)
  submit: boolean;    // gh로 직접 제출
  url: boolean;       // pre-filled URL 출력
  title?: string;
  body?: string;
}

export async function runReport(opts: ReportOptions): Promise<void> {
  const target = resolve(opts.target);
  const env = await collectEnv();
  const doctor = await collectDoctor(target);

  // --context: 에이전트가 읽을 수 있도록 구조화된 정보 출력
  if (opts.context) {
    console.log("\n[report:context]\n");
    console.log("## Environment\n");
    console.log(env);
    console.log("\n## Doctor\n");
    console.log(doctor);
    console.log(`\n## Issue tracker\n${ISSUES_URL}`);
    console.log(`\n---`);
    console.log("Collect a title and description from the user, then:");
    console.log(`  gh available → mise run report -- --submit --title "..." --body "..."`);
    console.log(`  no gh       → mise run report -- --url    --title "..." --body "..."`);
    return;
  }

  if (!opts.title || !opts.body) {
    console.error("[report] --title and --body are required with --submit or --url");
    process.exit(1);
  }

  const fullBody = buildBody(env, doctor, opts.body);

  // --submit: gh issue create
  if (opts.submit) {
    if (!(await ghAuthed())) {
      console.warn("[report] gh not authenticated. Falling back to URL.");
      console.log("\n" + buildUrl(opts.title, fullBody));
      return;
    }
    const r = await $`gh issue create --repo ${REPO} --title ${opts.title} --body ${fullBody}`
      .nothrow();
    if (r.exitCode !== 0) {
      console.warn("[report] gh issue create failed. URL fallback:");
      console.log("\n" + buildUrl(opts.title, fullBody));
    }
    return;
  }

  // --url: pre-filled URL 출력
  if (opts.url) {
    console.log("\n[report] Open this URL to file the issue:\n");
    console.log(buildUrl(opts.title, fullBody));
    return;
  }
}
