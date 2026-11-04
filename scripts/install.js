#!/usr/bin/env node

// Install what runs outside the repository into one directory, D: the exporter
// as a symlink back into scripts/, so an edit there takes effect with no
// reinstall, the native host as a copy, and Chrome's registration of that host.
// The exporter writes the export there too, and the host reads it.
//
// The host cannot be a link: a process Chrome starts is refused reading
// anything under ~/Documents ("Operation not permitted", so Chrome reports
// "Native host has exited"), the script a link resolves to included.
// my-foam's daemon runs D/export_bookmarks.js (README.md "Running").
//
// Run through `mise run install` (mise.toml says when it runs on its own).
// From a worktree, only the host comes from that worktree, so an edit to it can
// be tried before it is merged: the extension Chrome loads, and so the ID the
// host allows, and the exporter the daemon runs stay the main checkout's, which
// outlives the worktree.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const name = "local.safari_bookmarks.open_in_safari";
const scripts = realpathSync(dirname(fileURLToPath(import.meta.url)));
// The common git dir is the main checkout's .git, in a worktree as well.
const commonGitDir = execFileSync(
  "git",
  ["-C", scripts, "rev-parse", "--path-format=absolute", "--git-common-dir"],
  { encoding: "utf8" },
).trim();
const main = realpathSync(dirname(commonGitDir));
const extension = realpathSync(join(main, "extension"));
const d = join(homedir(), "Library/Application Support/safari-bookmarks");
const hosts = join(homedir(), "Library/Application Support/Google/Chrome/NativeMessagingHosts");

mkdirSync(d, { recursive: true });
mkdirSync(hosts, { recursive: true });

const exporter = join(d, "export_bookmarks.js");
rmSync(exporter, { force: true });
symlinkSync(join(main, "scripts/export_bookmarks.js"), exporter);

// Removed first, so a link left by an earlier install is replaced rather than
// written through into the repository.
const host = join(d, "open_in_safari_host.sh");
rmSync(host, { force: true });
copyFileSync(join(scripts, "open_in_safari_host.sh"), host);
chmodSync(host, 0o755);

const id = extensionId(extension);
const registration = {
  name,
  description:
    "Hand pages to Safari and read Safari's bookmarks for the Safari Bookmarks extension",
  path: host,
  type: "stdio",
  allowed_origins: [`chrome-extension://${id}/`],
};
writeFileSync(join(hosts, `${name}.json`), `${JSON.stringify(registration, null, 2)}\n`);
console.log(`installed into ${d} for chrome-extension://${id}/`);

/**
 * The ID Chrome gives an unpacked extension, which it derives from the
 * directory's path: the first 32 hex digits of its SHA-256, each spelled with
 * a-p in place of 0-f. Loading the extension from another path changes it.
 * @param {string} dir
 */
function extensionId(dir) {
  const hex = createHash("sha256").update(dir).digest("hex").slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + Number.parseInt(c, 16))).join("");
}
