# pi-workspace

YoloBox + Pi + mise agent workspace scaffold skill.

Works with **pi**, **Claude Code**, **Codex**, and 55+ agents via [skills.sh](https://skills.sh).

## Install

```bash
# via skills.sh (Claude Code, Codex, Cursor, Windsurf, ...)
npx skills add siren403/pi-workspace

# via pi
pi install npm:pi-workspace -l
```

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
.mise/tasks/agent       — launch pi in YoloBox sandbox
.mise/tasks/agent-fork  — fork into isolated workspace
.mise/tasks/agent-shell — shell into sandbox (debug)
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

```
/pi-workspace:prompts
```

Two modes:

**Static — inject a known template as-is:**

> "karpathy guidelines를 AGENTS.md에 추가해줘"
> "pi-workspace:prompts --install karpathy"

Fetches the template from GitHub and inserts it as a labeled block in `AGENTS.md`:

```markdown
<!-- pi-prompts:karpathy:start -->
## Karpathy Guidelines
...
<!-- pi-prompts:karpathy:end -->
```

Blocks can be updated later with `--force` or via `/pi-workspace:update`.

**Dynamic — project-aware synthesis (agent mode):**

> "현재 프로젝트에 맞는 에이전트 지침 프롬프트 제안해줘"
> "추천 프롬프트 합성해줘"
> "karpathy 가이드라인 참고해서 우리 프로젝트 스타일에 맞게 다듬어줘"

When you say this to an agent that has the skill loaded, the agent will:

1. Browse the prompt catalog and fetch referenced templates
2. Read your project context — `AGENTS.md`, tech stack, `.pi/settings.json`
3. Synthesize a tailored version (deduplicated, project-specific rules added)
4. Propose the result for your review
5. Write it to `AGENTS.md` only after you approve

> **Note:** Synthesis is done by the AI agent, not the mise task. The task provides data fetching and file writing primitives; the agent provides the intelligence. This works when you're talking to an agent (Claude Code, Codex, pi) that has the skill loaded — running the mise task alone just does static injection.

Custom sources (any public GitHub repo) are also supported:

> "forrestchang/andrej-karpathy-skills 참고해서 합성해줘"

```bash
mise run prompts -- --preview forrestchang/andrej-karpathy-skills
mise run prompts -- --target . --install forrestchang/andrej-karpathy-skills
```

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
mise run agent          # launch pi (interactive)
mise run agent-fork     # fork into an isolated workspace copy
mise run agent-fork -- feature-name  # named fork
mise run agent-shell    # shell only, no pi autorun (debug)
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
