# safari-bookmarks

Browse Safari's bookmarks from a Chrome side panel, and hand a page met in Chrome to Safari to bookmark it there.
Safari stays the one place bookmarks are kept: Chrome only reads them, so nothing races iCloud and Google Sync.

## Parts

- `extension/`: the Chrome extension, loaded unpacked.
  - The side panel lists the bookmarks from `extension/bookmarks.json`, with a filter, a text size control and a button that reads them again.
  - The context menu's "Open Page in Safari" and "Open Link in Safari" send the URL to the native host.
- `scripts/export_bookmarks.exs`: writes `extension/bookmarks.json` from `~/Library/Safari/Bookmarks.plist`.
- `scripts/open_in_safari_host.sh`: the native messaging host, which runs `open -a Safari <url>`.
  - Safari's own `x-safari-https` scheme needs no host, but it makes Safari show its default-browser banner on every handoff and turns http into https.
- `mise run install:host`: copies the host out of the repository and registers it with Chrome (see `mise.toml` for why).

## Running

The export and the host install run from a pitchfork daemon kept with the user's other daemons in the `mise.toml` of my-foam, a private repository (`[daemons.safari-bookmarks]`).
At start it runs `mise run install:host`, then watches Safari's directory with watchexec and re-exports on each change to `Bookmarks.plist`.

Done by hand, once per Chrome profile: open `chrome://extensions`, turn on Developer mode, and load `extension/` unpacked.
After a change to `manifest.json` or `background.js`, reload the extension there; the panel's files take effect when it reopens.

## Checks

`mise install` sets up the tools and the git hooks.
On commit, `mise run pre-commit` runs every `qa:` task in `mise.toml` (Biome; tsc, type-checking the JavaScript against Chrome's API types with no build; shellcheck and shfmt; rumdl; an offline link check) and the shared secret and link scans from dotfiles; CI runs the same `qa:` tasks.
`mise run fmt` formats every file they cover.
