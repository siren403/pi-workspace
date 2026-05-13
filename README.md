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

Supported args:

| Args | Description |
|------|-------------|
| `list` | Show prompt catalog |
| `preview <slug\|owner/repo>` | Preview template content |
| `install <slug>[,...]` | Inject template(s) into AGENTS.md as-is |
| `suggest` | Analyze project → recommend suitable templates |
| `compose [<slug\|owner/repo>...]` | Synthesize template(s) tailored to this project |

**Static inject:**

```
/pi-workspace:prompts install karpathy
/pi-workspace:prompts install karpathy,owner/repo
```

Fetches from GitHub and inserts as a labeled block in `AGENTS.md`:

```markdown
<!-- pi-prompts:karpathy:start -->
...
<!-- pi-prompts:karpathy:end -->
```

**suggest** — let the agent recommend:

```
/pi-workspace:prompts suggest
```

The agent runs `mise run prompts -- --context` to collect your project's current AGENTS.md, installed sections, `.pi/settings.json`, and tech stack, then recommends which catalog entries fit and why. You confirm before anything is written.

**compose** — synthesize tailored guidelines:

```
/pi-workspace:prompts compose
/pi-workspace:prompts compose karpathy
/pi-workspace:prompts compose karpathy,forrestchang/andrej-karpathy-skills
```

The agent collects project context, fetches the specified template(s), then synthesizes a customized version — deduplicating sections, removing conflicts, adding project-specific rules. The result is proposed for your review; written to AGENTS.md only after you approve.

> **Note:** `suggest` and `compose` are agent-executed flows. The mise task provides `--context` (project info collection) and `--write` (file writing); the AI agent provides the synthesis. Running the task alone does static injection only.

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
