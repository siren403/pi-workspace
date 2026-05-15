# pi-workspace

Source repository for the `pi-workspace` Agent Skill package.

The installable skills.sh package lives in `skills/pi-workspace/`. The repository root is used for development, dogfooding, and release checks.

## Install

Recommended:

```bash
npx skills add siren403/pi-workspace/skills/pi-workspace --full-depth
```

GitHub tree URL fallback:

```bash
npx skills add https://github.com/siren403/pi-workspace/tree/main/skills/pi-workspace --full-depth
```

`--full-depth` exposes `/pi-workspace:scaffold`, `/pi-workspace:doctor`, and the other subcommands as separate skills.

## Development

List repository helper tasks:

```bash
mise tasks
```

Dogfood the local skill package:

```bash
mise run dogfood:link
mise run dogfood
mise run dogfood:unlink
```

Run skill tasks through the nested package:

```bash
mise run skill:doctor -- --target .
mise run skill:verify -- --target <scaffolded-project>
mise run skill:install-check
```

Direct skill task execution requires trusting the nested mise config:

```bash
cd skills/pi-workspace
mise trust
mise run prompts -- --list
```

## Package Layout

```text
skills/pi-workspace/
  SKILL.md
  README.md
  .mise.toml
  .mise/tasks/
  templates/
  skills/
```

Keep shipped skill behavior inside `skills/pi-workspace/`. Keep repository-only development automation at the root.
