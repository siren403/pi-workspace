# Repository Instructions

This repository contains the source for the `pi-workspace` skill package. The installable skill lives under `skills/pi-workspace/`. The repository root is for development, dogfooding, and release automation.

## Instruction Routing

Before editing files, match the target path against this table and read the listed instruction files. More specific rows override or extend broader rows. If multiple rows match, read them in table order.

| Target path pattern | Read first |
| --- | --- |
| `**` | `AGENTS.md` |
| `.mise/**` | `.mise/AGENTS.md` |
| `.mise/tasks/**` | `.mise/tasks/AGENTS.md` |
| `skills/pi-workspace/**` | `skills/pi-workspace/AGENTS.md` |
| `skills/pi-workspace/.mise/**` | `skills/pi-workspace/.mise/AGENTS.md` |
| `skills/pi-workspace/.mise/tasks/**` | `skills/pi-workspace/.mise/tasks/AGENTS.md` |
| `skills/pi-workspace/templates/**` | `skills/pi-workspace/templates/AGENTS.md` if present |
| `skills/pi-workspace/skills/**` | `skills/pi-workspace/skills/AGENTS.md` if present |

For any file under a directory that contains an `AGENTS.md`, read the nearest ancestor `AGENTS.md` before editing. When adding, moving, or deleting a scoped `AGENTS.md`, update this table in the same change.

## Repository Layout

- `skills/pi-workspace/` is the installable skills.sh package.
- Root `.mise/` is for repository development tasks.
- `skills/pi-workspace/.mise/` is for tasks shipped with the skill package.
- Dogfood links under `.pi/skills`, `.agents/skills`, and `.claude/skills` are local-only and must not be committed.

## Project References

- Read `docs/architecture.md` before changing host/sandbox boundaries, runtime version management, managed file drift logic, smart mode routing, or scaffolded launcher tasks.
- Read `docs/pi-workspace-stabilization-plan.md` before implementing stabilization work or changing the planned sequencing for renderer, workspace state, runtime update, npm policy, intent routing, gitignore, or Docker cleanup changes.

## Task Policy

- Use `mise run <task>` as the documented automation entry point.
- Prefer `.mise/tasks/<group>/<name>` for grouped tasks.
- Prefer Bun/TypeScript for cross-platform task implementations, especially file/path/config operations.
- Use shell tasks only when the environment is clearly POSIX or the task is a thin launcher.
