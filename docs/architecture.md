# pi-workspace Architecture

Status: draft
Last updated: 2026-05-19

## Purpose

`pi-workspace` is a skills.sh-distributed workspace management skill for projects that use:

- `mise` for project-local tool/runtime management.
- `pi` as the coding agent runtime.
- `YoloBox` as the sandbox boundary.
- Optional agent integrations such as Codex, Claude Code, and pi subagents.

The skill's job is not to be a package manager for the host machine. Its job is to make a target project reproducible and operable as an agent workspace.

## Core Model

`pi-workspace` separates three scopes:

| Scope | Owner | Examples | Policy |
| --- | --- | --- | --- |
| Skill package | `skills/pi-workspace/` | `SKILL.md`, subskills, shipped mise tasks, templates | Updated by `npx skills add siren403/pi-workspace --full-depth` |
| Target workspace | User project | `.mise.toml`, `mise.lock`, `.yolobox.Dockerfile`, `.agent-workspace.json`, `.pi/settings.json` | Managed by `pi-workspace` primitives after approval |
| Host environment | User machine | global `pi`, global `yolobox`, Docker daemon, global npm config | Checked by doctor, but not automatically updated |

The target workspace runtime is project-local. If the target `.mise.toml` contains:

```toml
[tools]
"npm:@earendil-works/pi-coding-agent" = "latest"
```

then the resolved `pi` runtime is the version pinned in `mise.lock`. The host/global `pi` binary is not the source of truth for the project.

## Components

### Skill Entry Points

The installable skill exposes one smart mode plus primitive subskills:

- `/pi-workspace`
- `/pi-workspace:doctor`
- `/pi-workspace:verify`
- `/pi-workspace:scaffold`
- `/pi-workspace:update`
- `/pi-workspace:subagents`
- `/pi-workspace:extensions`
- `/pi-workspace:prompts`
- `/pi-workspace:report`
- `/pi-workspace:release`

Smart mode is the user-facing coordinator. Primitive subskills are implementation and automation surfaces.

### Shipped Mise Tasks

Skill implementation lives in:

```text
skills/pi-workspace/.mise/tasks/
```

These tasks run from the installed skill directory and operate on a target project passed with `--target`.

Key tasks:

- `status`: read-only smart-mode planner.
- `doctor`: read-only environment and target safety check.
- `verify`: read-only workspace integrity check.
- `scaffold`: creates a new target workspace.
- `update`: previews and applies managed file refreshes.
- `subagents`, `extensions`, `prompts`, `report`: focused configuration workflows.

### Target Workspace Files

Scaffolded target projects receive:

```text
.mise.toml
mise.lock
.yolobox.toml
.yolobox.Dockerfile
.mise/tasks/pi
.mise/tasks/pi:fork
.mise/tasks/pi:shell
.mise/tasks/pi:version
AGENTS.md
.agent-workspace.json
.gitignore additions
.pi/settings.json
```

Not every file is created by the same step. Template files come from scaffold/update. Tool caches, lockfiles, and pi settings may be created by `mise install`, `mise lock`, or `pi install`.

## Host and Sandbox Boundary

### Host

The host owns:

- Docker daemon.
- `yolobox` CLI.
- Host `mise` cache.
- Global/user npm config.
- User credentials and pi auth material.

Host `pi update` is not used to update a target project's pinned runtime. It may update the host CLI, but a project using `mise.lock` will continue to use its locked runtime until the project runtime is upgraded.

### Sandbox

The sandbox owns the running agent process and the isolated execution environment. The target project directory is mounted into the sandbox, so changes to mounted files such as `mise.lock` can be visible outside the sandbox.

New scaffolded sandboxes include:

```dockerfile
ENV PI_WORKSPACE_SANDBOX=1
```

Smart mode also uses fallback signals such as `/.dockerenv` and `/proc/1/cgroup` to detect container execution.

### Boundary Rule

Sandbox code may operate on mounted project files when explicitly approved, but host preparation remains a host responsibility.

For runtime upgrades:

- Host path: update project lock, sync managed files, verify, then re-enter sandbox.
- Sandbox-with-mise path: update mounted lock if approved, then exit and complete host follow-up.
- Sandbox-without-mise path: stop before mutation and rerun from host.

## Runtime Version Management

### Source of Truth

The project `pi` version is the resolved `npm:@earendil-works/pi-coding-agent` entry in `mise.lock`.

The sandbox `.yolobox.Dockerfile` must install that exact version, not a floating `latest`.

### Update Flow

When the user says `pi update`, `mise.lock pi 구버전`, or a clear equivalent, smart mode treats this as a project runtime update intent.

Expected flow:

1. Inspect target `.mise.toml`.
2. Inspect current `mise.lock` runtime.
3. Check latest available runtime with `mise outdated --local --json npm:@earendil-works/pi-coding-agent`.
4. Show a dry-run.
5. Apply `mise upgrade --local npm:@earendil-works/pi-coding-agent` only after approval.
6. Sync `.yolobox.Dockerfile` through managed update preview/application.
7. Verify.
8. Tell the user to exit existing pi/sandbox sessions and re-enter with `mise run pi`.

### npm Release-Policy Overrides

Some npm environments may set release filters such as:

- `before`
- `min-release-age`

These can block newly published `pi` runtime versions. `pi-workspace` does not persistently change npm config. When a user approves immediate update despite those filters, commands use one-command environment overrides:

```bash
NPM_CONFIG_BEFORE= NPM_CONFIG_MIN_RELEASE_AGE=0 mise upgrade --local npm:@earendil-works/pi-coding-agent
```

The sandbox Dockerfile also uses a one-command override for exact pinned installs so the sandbox can reproduce the lockfile:

```dockerfile
RUN NPM_CONFIG_BEFORE= NPM_CONFIG_MIN_RELEASE_AGE=0 npm install -g --prefix /usr/local @earendil-works/pi-coding-agent@<locked-version>
```

This override is limited to the exact pinned runtime install. It must not be expanded into global npm config mutation, broad `npm update`, or raw `pi update`.

## Managed Files and Drift

### Manifest

`.agent-workspace.json` records the last applied workspace state. It is not the only source of truth.

Drift checks combine:

- Current installed skill templates.
- Manifest-managed files.
- Rendered target-specific expected content, especially lock-driven `.yolobox.Dockerfile`.

### Read-Only Commands

These commands must not modify target files:

- `doctor`
- `status`
- `verify`
- `update --diff`

They may inspect files, run read-only checks, and print proposed commands or diffs.

### Mutating Commands

These commands may mutate target state:

- `scaffold`
- `update --force`
- explicit runtime upgrade commands after approval
- explicit pi package install/configuration commands after approval

Managed file overwrites must be previewed with:

```bash
mise run update -- --target <target> --diff
```

and applied only after approval:

```bash
mise run update -- --target <target> --force
```

## Smart Mode

Smart mode is a planner, not a shell command passthrough.

The raw user phrase `pi update` must not be executed as `pi update`. It is interpreted as intent and routed to the project runtime workflow.

Smart mode output is split into:

- `Recommended workflow`: required steps for the current request.
- `Deferred optional follow-ups`: useful but non-required follow-up actions.
- `Not needed now`: already satisfied checks.

If a recommended workflow exists, approval should cover that workflow only. Optional follow-ups are proposed after the required work succeeds.

## Scaffolded Runtime Tasks

Target projects receive launcher tasks:

- `mise run pi`
- `mise run pi:fork`
- `mise run pi:shell`
- `mise run pi:version`

These tasks are target-local and must not depend on the installed skill path. Any helper they need must be copied into the target workspace as a managed file.

`mise run pi` launches the sandbox and may synchronize `.yolobox.Dockerfile` to the locked runtime. This behavior must be visible and deterministic. Long term, Dockerfile rendering should be centralized so scaffold, update, verify, and target launchers agree.

## Docker Image Cleanup

YoloBox custom images can accumulate as `.yolobox.Dockerfile` changes.

Cleanup must be conservative:

- Scope only to `yolobox-custom:*`.
- Avoid broad Docker prune commands.
- Preserve the command exit status from the sandbox run.
- Do not remove images referenced by any container.
- Use deterministic image age metadata, not display order.
- Prefer report-only behavior unless safe removal is explicitly enabled.

## Extension and Prompt Layers

`pi-workspace` also manages advisory layers:

- pi extension recommendations and installs.
- subagent role/model configuration.
- AGENTS.md prompt sections.

These layers are deliberately separate from the runtime/sandbox layer. Extension recommendations are advisory and should not become required workflow unless the target workspace is missing a required package such as `npm:pi-subagents`.

## Invariants

- Project runtime comes from target `mise.lock`.
- Sandbox runtime must match target `mise.lock`.
- Host/global `pi update` is outside project runtime management.
- npm release-policy overrides are scoped to exact commands and never persisted.
- `doctor`, `status`, `verify`, and `update --diff` are read-only.
- Managed overwrites require diff preview and approval.
- `.agent-workspace.json` is a state record, not the only managed-file source.
- Target launcher tasks cannot rely on the installed skill path.
- Optional follow-ups do not mix into required workflow without explicit request.

## Known Stabilization Work

See [pi-workspace-stabilization-plan.md](./pi-workspace-stabilization-plan.md) for the phased implementation plan.
