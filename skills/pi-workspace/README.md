# pi-workspace

YoloBox + Pi + mise agent workspace scaffold skill.

Works with **pi**, **Claude Code**, **Codex**, and 55+ agents via [skills.sh](https://skills.sh).

## Agent Install

저장소 링크만 공유하면 에이전트가 직접 설치합니다.

> **Claude Code / Codex / Cursor 등에게:**
>
> `https://github.com/siren403/pi-workspace/tree/main/skills/pi-workspace` 스킬을 full-depth로 설치해줘.

에이전트가 실행할 명령:

```bash
mkdir -p .claude
npx skills add siren403/pi-workspace/skills/pi-workspace --full-depth
```

---

## Install

```bash
# 전체 서브커맨드를 개별 항목으로 설치 (권장)
npx skills add siren403/pi-workspace/skills/pi-workspace --full-depth

# GitHub tree URL fallback
npx skills add https://github.com/siren403/pi-workspace/tree/main/skills/pi-workspace --full-depth

# 메인 스킬만 설치
npx skills add siren403/pi-workspace/skills/pi-workspace

# via pi
pi install npm:pi-workspace -l
```

`--full-depth` 옵션을 사용하면 `/pi-workspace:scaffold`, `/pi-workspace:prompts` 등 서브커맨드가 스킬 목록에 개별 항목으로 노출됩니다.

> **Claude Code 주의:** skills.sh는 `.claude/` 디렉토리가 있을 때만 symlink를 생성합니다.
> 설치 전 디렉토리가 없다면 먼저 만들어 주세요.
> ```bash
> mkdir -p .claude
> npx skills add siren403/pi-workspace/skills/pi-workspace --full-depth
> ```

## Commands

| Command | Description |
|---------|-------------|
| `/pi-workspace` | Doctor check → suggest next step |
| `/pi-workspace:scaffold` | Scaffold workspace in a new project |
| `/pi-workspace:subagents` | Configure sub-agents from authenticated providers |
| `/pi-workspace:extensions` | Browse and install pi extension catalog |
| `/pi-workspace:prompts` | Manage and synthesize agent instruction prompts |
| `/pi-workspace:verify` | Verify workspace integrity |
| `/pi-workspace:update` | Update managed files from templates |
| `/pi-workspace:doctor` | Check environment only |

## Prerequisites

- [mise](https://mise.jdx.dev) — task runner & tool version manager
- [pi](https://pi.dev) — AI coding agent (`npm install -g @earendil-works/pi-coding-agent`)
- [Bun](https://bun.sh) ≥ 1.2 (installed automatically by mise)

---

## Usage

### New project setup

```
/pi-workspace:scaffold
```

The agent runs a doctor check, reports any issues, then scaffolds:

```
.yolobox.toml           — YoloBox sandbox config
.yolobox.Dockerfile     — pi pre-installed image
.mise.toml              — tool versions + task shortcuts
AGENTS.md               — project-level agent instructions
.mise/tasks/pi          — launch pi in YoloBox sandbox
.mise/tasks/pi:fork     — fork into isolated workspace
.mise/tasks/pi:shell    — shell into sandbox (debug)
```

### Environment check

```
/pi-workspace:doctor
```

Checks: mise, pi, pi version ≥ 0.70, YoloBox, pi auth, target writable, no secrets committed.

```
/pi-workspace
```

Same check, but also suggests what to do next based on current state.

### Configure sub-agents

After logging in to a provider (`pi /login`):

```
/pi-workspace:subagents
```

Reads `pi --list-models`, proposes role assignments (explore / bulk / patch / review), and writes `.pi/settings.json` agentOverrides + `.pi/agents/<role>.md`.

| Role | Priority | Use case |
|------|----------|---------|
| `explore` | budget, thinking | Read-only codebase exploration |
| `bulk` | budget, fast | Large-scale summarization |
| `patch` | budget, thinking | Applying approved edits |
| `review` | premium, thinking | Quality gate before release |

### Install pi extensions

```
/pi-workspace:extensions
```

Shows the curated extension catalog with current install status, then installs selected packages at project scope (`pi install -l`).

| Package | Category |
|---------|----------|
| `pi-subagents` | workflow — required for sub-agents |
| `context-mode` | workflow |
| `ask-user-question` | workflow |
| `rpiv-todo` | workflow |
| `pi-lens` | quality |
| `pi-web-access` | integration |
| `pi-mcp-adapter` | integration |
| `pi-powerline-footer` | ui |

### Agent instruction prompts

Three invocation patterns:

---

**1. Smart mode — no args**

```
/pi-workspace:prompts
```

Collects project context, then decides what to do:

- No prompt sections in AGENTS.md → enters `suggest` flow
- Sections exist but templates have updates → proposes refresh
- Everything up to date → summarizes current config

---

**2. Explicit args**

| Args | Description |
|------|-------------|
| `list` | Show prompt catalog |
| `preview <slug\|owner/repo>` | Preview template content from GitHub |
| `install <slug>[,...]` | Inject template(s) into AGENTS.md as labeled blocks |
| `suggest` | Analyze project → recommend suitable templates with reasoning |
| `compose [<slug\|owner/repo>...]` | Synthesize template(s) tailored to this project |

```
/pi-workspace:prompts list
/pi-workspace:prompts preview karpathy
/pi-workspace:prompts install karpathy
/pi-workspace:prompts install karpathy,owner/repo
/pi-workspace:prompts suggest
/pi-workspace:prompts compose
/pi-workspace:prompts compose karpathy
/pi-workspace:prompts compose karpathy,owner/repo
```

`install` injects templates as-is with section markers:

```markdown
<!-- pi-prompts:karpathy:start -->
...
<!-- pi-prompts:karpathy:end -->
```

`suggest` and `compose` collect project context first (`AGENTS.md`, `.pi/settings.json`, tech stack), then the agent analyzes and synthesizes. Results are always proposed for review — nothing is written without your approval.

---

**3. Free-form requests**

```
/pi-workspace:prompts "karpathy 참고해서 합성해줘"
/pi-workspace:prompts "추천 프롬프트 보여줘"
/pi-workspace:prompts "현재 프로젝트에 맞게 최적화해줘"
```

The agent infers intent and routes to the appropriate flow:

| Keywords | Routes to |
|----------|-----------|
| 합성, 조합, 맞게, 다듬어, 최적화 | `compose` |
| 추천, 뭐가 좋아, 어떤 거 | `suggest` |
| 추가, 설치, 넣어줘 + slug/repo | `install` |
| 보여줘, 내용, 뭐가 있어 | `preview` / `list` |
| ambiguous | smart mode → ask for clarification |

---

> `suggest` and `compose` are agent-executed flows. The mise task provides `--context` (structured project info) and `--write` (file I/O); the AI agent does the analysis and synthesis. Running the task directly does static injection only.

### Verify and update

```
/pi-workspace:verify   — check managed files match templates
/pi-workspace:update   — re-apply templates, refresh prompt blocks
```

---

## Running tasks directly

All agent commands map to mise tasks in the skill directory:

```bash
cd .pi/skills/pi-workspace   # or wherever the skill is installed
mise trust                    # required the first time in a new install path

mise run doctor    -- --target <path>
mise run scaffold  -- --target <path> [--force] [--check] [--diff]
mise run subagents -- --target <path> [--apply] \
                      [--explore provider/model] \
                      [--bulk provider/model] \
                      [--patch provider/model] \
                      [--review provider/model]
mise run extensions -- --target <path> [--install context-mode,pi-lens]
mise run prompts   -- --list
mise run prompts   -- --preview karpathy
mise run prompts   -- --preview owner/repo
mise run prompts   -- --target <path> --install karpathy[,owner/repo,...] [--force]
echo "<content>" | mise run prompts -- --target <path> --write --section <name>
mise run verify    -- --target <path>
mise run update    -- --target <path> [--force]
```

After scaffold, launch pi inside the YoloBox sandbox:

```bash
mise run pi             # launch pi (interactive)
mise run pi:fork        # fork into an isolated workspace copy
mise run pi:fork -- feature-name  # named fork
mise run pi:shell       # shell only, no pi autorun (debug)
```

---

## Security

- Never copies secrets (`auth.json`, API keys, `.env`, SSH keys)
- Only project-scope installs (`pi install -l`)
- No `--force` overwrites without explicit flag
- Stops on doctor ERROR before any scaffold action
- Synthesized prompts are always shown to the user before being written

## License

MIT
