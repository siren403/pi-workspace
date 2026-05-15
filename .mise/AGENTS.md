# Mise Workspace Rules

- This repository's automation entrypoint is `mise run <task>`.
- Document user-facing workflows as `mise run <task>`.
- Before adding or changing tasks, verify the current mise task behavior with the local CLI or docs.
- Check in this order when unsure:
  - `mise tasks --help`
  - `mise run --help`
  - `mise tasks info <task>`
  - `mise tasks ls --extended`
  - https://mise.jdx.dev/tasks/
- Root `.mise.toml` is for repository development.
- Shipped skill runtime configuration belongs in `skills/pi-workspace/.mise.toml`.
- Root tasks that invoke skill tasks must run them with `cwd` set to `skills/pi-workspace`; do not assume nested skill tasks are visible from the repository root.
