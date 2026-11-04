# safari-bookmarks

Browse Safari's bookmarks from a Chrome side panel, and hand a page met in Chrome to Safari to bookmark it there.
Safari stays the one place bookmarks are kept: Chrome only reads them, so nothing races iCloud and Google Sync.

## Parts

- `extension/`: the Chrome extension, loaded unpacked.
  - The side panel lists the bookmarks it asks the native host for, with a filter, a text size control and a button that reads them again.
  - The context menu's "Open Page in Safari" and "Open Link in Safari" send the URL to the native host.
- `scripts/export_bookmarks.js`: writes `bookmarks.json` from `~/Library/Safari/Bookmarks.plist`.
- `scripts/open_in_safari_host.sh`: the native messaging host. It runs `open -a Safari <url>`, and replies to the panel with `bookmarks.json`.
  - Safari's own `x-safari-https` scheme needs no host, but it makes Safari show its default-browser banner on every handoff and turns http into https.
- `mise run install`: links the exporter and copies the host into `~/Library/Application Support/safari-bookmarks/`, where the export is written too, and registers the host with Chrome (see `scripts/install.js` for why the host is a copy).

## Running

`mise install` runs `mise run install` in the main checkout, and registers a post-merge hook that runs it again after a `git pull` that changes the host or how it is installed, so the copied host follows `main`; an edit to the host not yet merged takes effect after `mise run install` by hand.
Once per Chrome profile: open `chrome://extensions`, turn on Developer mode, and load `extension/` unpacked.
After a change to `manifest.json` or `background.js`, reload the extension there; the panel's files take effect when it reopens.

The export runs from a pitchfork daemon kept with the user's other daemons in the `mise.toml` of my-foam, a private repository (`[daemons.safari-bookmarks]`).
It watches Safari's directory with watchexec and runs the installed `export_bookmarks.js` at start and on each change to `Bookmarks.plist`.

## Checks

`mise install` sets up the tools and the git hooks.
On commit, `mise run pre-commit` runs every `qa:` task in `mise.toml` (Biome; tsc, type-checking the JavaScript against Chrome's and Node's API types with no build; shellcheck and shfmt; rumdl; an offline link check) and the shared secret and link scans from dotfiles; CI runs the same `qa:` tasks.
`mise run fmt` formats every file they cover.
