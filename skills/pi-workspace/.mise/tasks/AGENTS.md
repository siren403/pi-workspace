# Skill Mise File Task Rules

- File tasks are executable files under `.mise/tasks`.
- Prefer grouped tasks as `.mise/tasks/<group>/<name>`.
- Use `_default` for a group default task.
- Prefer Bun/TypeScript for new tasks when cross-platform behavior matters.
- External CLI calls may use Bun `$`, but avoid shell pipes, globs, redirects, and heredocs inside task logic.
- Prefer Bun/Node APIs for filesystem work, path calculations, JSON/TOML updates, and symlink creation/removal.
- Shell tasks are allowed for thin launchers or clearly POSIX-only work.
- Task files must be executable.
- Do not rely on `MISE_TASK_NAME` formatting for behavior.
- These tasks are part of the shipped skill package; keep their dependencies available through `skills/pi-workspace/.mise.toml`.
