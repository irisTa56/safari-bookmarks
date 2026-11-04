# CLAUDE.md

- What each part does and how they connect: [`README.md`](README.md).
- [`mise.toml`](mise.toml) is the task list and carries its own reasons. `mise install` installs the tools and the git hooks, `mise run pre-commit` is the gate the pre-commit hook runs, and `mise run fmt` formats every file the checks cover.
- The extension is plain JavaScript Chrome loads with no build; types come from JSDoc, checked by tsc. Do not add a build step.
- The daemon that runs the export lives in my-foam's `mise.toml`, not here; a change to how the export or the host install is invoked is made there too.
- Changes land as direct commits on `main`.
