# Pi Workspace Stabilization Plan

Status: planning
Last updated: 2026-05-19

Architecture context: [architecture.md](./architecture.md)

## Goal

Stabilize `pi-workspace` around one consistent model:

- Project `pi` runtime is managed by `.mise.toml` and `mise.lock`.
- Host/global `pi update` is not the project runtime update path.
- The YoloBox sandbox installs the exact `pi` runtime pinned by the target project's lockfile.
- Managed file drift is detected and repaired through `status`/`update`/`verify`, with diffs shown before overwrites.
- npm release-policy overrides are explicit, one-command, non-persistent, and limited to exact pinned runtime installs or approved project runtime upgrades.

## Approved Direction

- Keep project-local runtime pinning with `mise.lock`.
- Keep sandbox runtime aligned to the lockfile.
- Keep `NPM_CONFIG_BEFORE= NPM_CONFIG_MIN_RELEASE_AGE=0` only as a scoped command-level override.
- Keep smart mode as the high-level entry point that proposes a workflow, then executes approved primitives.
- Keep `doctor`, `status`, and `verify` read-only.
- Keep mutation in `scaffold`, `update --force`, and explicit install/update commands only.

## Required Constraints

1. `mise run pi -- --pi-version <x>` semantics must be explicit.
   - If kept, it is a one-shot override and must be tested with and without an existing lockfile.
   - If deprecated, document the replacement path.

2. Runtime upgrade must not silently overwrite managed files.
   - After `mise upgrade --local npm:@earendil-works/pi-coding-agent`, Dockerfile sync must use `update --diff`.
   - Apply `update --force` only within the user's approval scope.
   - Stop if the diff contains unexpected changes.

3. Sandbox-with-mise path must have a strict boundary.
   - Sandbox may update the mounted `mise.lock`.
   - Host `mise install` and `mise run pi` are follow-up actions to run outside the sandbox.
   - Do not present host-only commands as actions to execute from inside the sandbox.

4. Shared workspace state must be read-only.
   - Shared inspection code may compute drift and expected content.
   - It must not write files or run install/update commands.

5. Renderer sharing must work in installed target projects.
   - Target shell tasks cannot import skill-side Bun modules unless a managed helper is copied into the scaffold.
   - If a scaffold helper is added, it must be included in managed files, drift checks, and tests.

6. Docker cleanup must be conservative.
   - No broad prune.
   - No deletion of images referenced by any container.
   - "Newest" must be based on Docker creation metadata, not CLI output order.
   - Cleanup should be opt-in or report-only by default unless the safe removal rules are proven.

## Implementation Phases

### Phase 1: Centralize Dockerfile Rendering

Create a single source of truth for `.yolobox.Dockerfile`.

Files:

- Add or expand `skills/pi-workspace/.mise/tasks/lib/dockerfile.ts`.
- Update `skills/pi-workspace/.mise/tasks/lib/templates.ts`.
- Update scaffold templates under `skills/pi-workspace/templates/scaffold/`.

Requirements:

- Provide `readLockedPiVersion(target)`.
- Provide `renderYoloboxDockerfile({ piVersion })`.
- Validate exact pi versions before rendering.
- Ensure `status`, `verify`, and `update` compare against the rendered Dockerfile.
- Decide and document how target tasks regenerate Dockerfile content.

Tests:

- Template Dockerfile renders expected sandbox marker, mise install, npm override, and pinned pi install.
- Fixture with `mise.lock` pinned to a newer version expects that version in status/verify/update.
- `pi`, `pi:version`, and template Dockerfile remain semantically aligned.

### Phase 2: Shared Workspace State Model

Add a read-only workspace state layer.

Files:

- Add `skills/pi-workspace/.mise/tasks/lib/workspace-state.ts`.
- Refactor `status-runner.ts`, `verify-runner.ts`, `checks.ts`, and `update-runner.ts` to use it.

Responsibilities:

- Manifest read and normalization inputs.
- Active template file list.
- Missing managed files.
- Out-of-sync managed files using rendered Dockerfile content.
- Missing `.gitignore` patterns.
- Required package status.
- Executable task status.

Tests:

- `doctor`, `status`, and `verify` agree on lock-driven Dockerfile drift.
- Stale manifest fixtures still include current template files.
- No read-only command writes files.

### Phase 3: Runtime Upgrade Workflow Completeness

Ensure smart mode accounts for post-upgrade Dockerfile drift.

Files:

- `skills/pi-workspace/.mise/tasks/lib/status-runner.ts`
- `skills/pi-workspace/SKILL.md`
- `skills/pi-workspace/README.md`

Required workflow after approved project runtime upgrade:

1. Dry-run runtime upgrade.
2. Apply runtime upgrade.
3. Show managed update diff.
4. Apply managed update if the diff is expected and approved.
5. Verify.
6. Tell the user to exit existing pi/sandbox sessions and re-enter with `mise run pi`.

Sandbox-with-mise variant:

1. Update mounted `mise.lock` in sandbox if approved.
2. Stop and tell the user to exit sandbox.
3. Run host `mise install`.
4. Run host-side managed update/verify if needed.
5. Re-enter with `mise run pi`.

Tests:

- Clean workspace runtime upgrade plan includes Dockerfile sync before final verify.
- Sandbox runtime update plan includes host follow-up, not host commands to run inside sandbox.

### Phase 4: npm Release-Policy Branch

Make npm policy handling explicit and bounded.

Files:

- `skills/pi-workspace/.mise/tasks/lib/pi-runtime.ts`
- `skills/pi-workspace/.mise/tasks/lib/status-runner.ts`
- `skills/pi-workspace/SKILL.md`
- `skills/pi-workspace/README.md`

Requirements:

- Report active `before` and `min-release-age` values.
- Add a report field such as `requiresTemporaryNpmPolicyOverride`.
- Ask for explicit approval before using overrides.
- Use only command-level overrides:

```bash
NPM_CONFIG_BEFORE= NPM_CONFIG_MIN_RELEASE_AGE=0 mise upgrade --local npm:@earendil-works/pi-coding-agent
```

- Do not persist npm config changes.
- Do not use raw `pi update`, global npm update/install, or version guessing as fallback.

Tests:

- Policy branch includes override dry-run and override upgrade.
- Policy branch excludes raw `pi update`.
- Sandbox policy branch includes host follow-up guidance.

### Phase 5: Intent Classifier Tightening

Reduce false runtime-update routing.

File:

- `skills/pi-workspace/.mise/tasks/lib/status-runner.ts`

Runtime intent should require strong signals:

- Exact `pi update`.
- `pi-coding-agent`.
- `mise.lock` with pi/runtime/update context.
- Sandbox plus pi version/update notice.
- Clear Korean equivalents.

Generic skill/workspace phrases must not trigger runtime registry checks:

- "재설치 후 최신 상태 확인"
- "latest 상태 확인"
- "pi-workspace update"
- "버전 확인"

Tests:

- Add intent table coverage for runtime and non-runtime cases.

### Phase 6: Gitignore Drift Handling

Make `.gitignore` drift repairable through update.

Files:

- `skills/pi-workspace/.mise/tasks/lib/gitignore.ts`
- `skills/pi-workspace/.mise/tasks/lib/update-runner.ts`
- `skills/pi-workspace/.mise/tasks/lib/verify-runner.ts`
- `skills/pi-workspace/.mise/tasks/lib/status-runner.ts`

Requirements:

- Export a single set of required patterns.
- Inspect missing patterns read-only.
- `update --diff` shows proposed `.gitignore` injection.
- `update --force` appends missing patterns without deleting user content.
- Avoid duplicate patterns where practical.

Tests:

- Missing one pattern triggers update.
- Diff shows only the proposed injection.
- Force update appends only missing patterns.
- Verify passes afterward.

### Phase 7: Docker Image Cleanup Safety

Make cleanup predictable and safe.

Files:

- `skills/pi-workspace/templates/scaffold/.mise/tasks/pi`
- `skills/pi-workspace/templates/scaffold/.mise/tasks/pi:shell`
- `skills/pi-workspace/templates/scaffold/.mise/tasks/pi:fork`
- Documentation if user-visible behavior changes.

Requirements:

- Prefer report-only by default, or require `PI_WORKSPACE_CLEAN_IMAGES=1`.
- Scope to `yolobox-custom:*`.
- Determine newest by creation timestamp.
- Skip any image referenced by any container.
- Preserve the sandbox command exit status.
- Warn clearly when Docker is unavailable or cleanup cannot run.

Tests:

- Fake `docker` and `yolobox` commands through `PATH`.
- Docker absent or unauthorized does not fail the pi task.
- One image means no removal.
- Used images are skipped.
- Cleanup enabled removes only eligible old images.

## Verification Gate

Before merging implementation:

```bash
mise run e2e:smart
mise run e2e:cold-start
mise run skill:install-check
npx skills add ./skills/pi-workspace --list --full-depth
git diff --check
```

Add focused tests for changed behavior in the relevant phase. For changes touching real target workspaces, verify against a temp fixture first, then optionally against `~/workspace/homework` without destructive edits unless explicitly approved.
