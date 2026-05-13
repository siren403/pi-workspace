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
| `/pi-workspace:verify` | Verify workspace integrity |
| `/pi-workspace:update` | Update managed files from templates |
| `/pi-workspace:doctor` | Check environment only |

## Prerequisites

- [mise](https://mise.jdx.dev) — task runner & tool version manager
- [pi](https://pi.dev) — AI coding agent (`npm install -g @earendil-works/pi-coding-agent`)
- [Bun](https://bun.sh) ≥ 1.2 (installed automatically by mise)

## What It Does

### `/pi-workspace:scaffold`

Copies workspace templates into your project:

```
.yolobox.toml          — YoloBox sandbox config
.yolobox.Dockerfile    — pi pre-installed image
.mise.toml             — tool versions + task shortcuts
AGENTS.md              — project-level agent instructions
.mise/tasks/agent      — launch pi in YoloBox sandbox
.mise/tasks/agent-fork — fork into isolated workspace
.mise/tasks/agent-shell — shell into sandbox (debug)
```

Runs doctor first. Stops on ERROR; warns but continues on WARN (with confirmation).

### `/pi-workspace:subagents`

Reads `pi --list-models` to discover authenticated providers, then proposes role assignments:

| Role | Priority | Context |
|------|----------|---------|
| `explore` | budget, thinking | large |
| `bulk` | budget, no thinking | large |
| `patch` | budget, thinking | small |
| `review` | premium, thinking | large |

Writes `.pi/settings.json` agentOverrides and `.pi/agents/<role>.md`.

### `/pi-workspace:extensions`

Curated catalog of pi extensions (project scope):

| Package | Category |
|---------|----------|
| `pi-subagents` | workflow (required for subagents) |
| `context-mode` | workflow |
| `ask-user-question` | workflow |
| `rpiv-todo` | workflow |
| `pi-lens` | quality |
| `pi-web-access` | integration |
| `pi-mcp-adapter` | integration |
| `pi-powerline-footer` | ui |

## Usage with mise

After scaffold, run pi inside the YoloBox sandbox:

```bash
mise run agent          # launch pi (interactive)
mise run agent-fork     # fork into isolated workspace
mise run agent-shell    # shell only (no pi autorun)
```

Run skill tasks directly from the skill directory:

```bash
cd .pi/skills/pi-workspace

mise run doctor    -- --target <path>
mise run scaffold  -- --target <path>
mise run subagents -- --target <path> [--apply] [--explore provider/model] [--review provider/model]
mise run extensions -- --target <path> [--install context-mode,pi-lens]
mise run verify    -- --target <path>
mise run update    -- --target <path>
```

## Security

- Never copies secrets (`auth.json`, API keys, `.env`, SSH keys)
- Only project-scope installs (`pi install -l`)
- No `--force` overwrites without explicit flag
- Stops on doctor ERROR before any scaffold action

## License

MIT
