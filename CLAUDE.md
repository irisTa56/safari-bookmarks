# CLAUDE.md

- What each part does and how they connect: [`README.md`](README.md).
- [`mise.toml`](mise.toml) is the task list and carries its own reasons. `mise install` installs the tools and the git hooks, `mise run pre-commit` is the gate the pre-commit hook runs, and `mise run fmt` formats every file the checks cover.
- The extension and the exporter are plain JavaScript that Chrome and Node run with no build; types come from JSDoc, checked by tsc. Do not add a build step.
- The daemon that runs the export lives in my-foam's `mise.toml`, not here; it runs the exporter `mise run install` links into `~/Library/Application Support/safari-bookmarks/`, so renaming that link is a change made there too.
- Changes land as direct commits on `main`.
