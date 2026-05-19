# Pi Workspace Skill Instructions

This directory is the installable `pi-workspace` skill package. Keep it self-contained: everything needed by skills.sh or pi package installation should live under this directory.

## Boundaries

- Do not add repository-only development configuration here.
- Keep root repository automation in the repository root `.mise/`.
- Keep shipped skill commands in `skills/pi-workspace/.mise/tasks/`.
- Keep user project scaffold templates in `skills/pi-workspace/templates/`.

## Architecture References

- For host/sandbox boundaries, project-local pi runtime pinning, managed file drift, smart mode behavior, and npm release-policy override rules, read `../../docs/architecture.md`.
- For approved stabilization sequencing and required constraints, read `../../docs/pi-workspace-stabilization-plan.md`.

## Installation

- The primary skills.sh install command is:
  `npx skills add siren403/pi-workspace --full-depth`
- The explicit GitHub tree URL fallback is:
  `npx skills add https://github.com/siren403/pi-workspace/tree/main/skills/pi-workspace --full-depth`
- `--full-depth` is required when users need the subcommands exposed as separate skills.
