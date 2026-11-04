# Project Guidelines

- What each part does and how they connect: `README.md`.
- Checks: `hk check` (`hk run pre-commit` to also apply fixes), defined in `hk.pkl` and run on commit; `mise run fmt` formats every file in scope.
- The extension is plain JavaScript Chrome loads with no build; types come from JSDoc, checked by tsc. Do not add a build step.
- The daemon that runs the export lives in my-foam's `mise.toml`, not here; a change to how the export or the host install is invoked is made there too.
- Changes land as direct commits on `main`.
