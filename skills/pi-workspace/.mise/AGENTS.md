# Skill Mise Rules

- This mise configuration is shipped with the `pi-workspace` skill package.
- Do not put repository-only dogfood or release automation here.
- Skill command implementations belong in this directory's `.mise/tasks`.
- File creation and updates performed by the skill should go through mise tasks, not direct agent edits.
- Installed copies may require `mise trust` before `mise run <task>` works from the skill directory.
