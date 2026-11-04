#!/usr/bin/env node

// Export Safari's bookmarks as JSON for the extension (extension/), so Chrome
// can browse them read-only without a two-way sync that would race iCloud and
// Google Sync.
//
// Usage:
//   export_bookmarks.js [OUT]
//
// OUT defaults to bookmarks.json in the install directory (`mise run install`),
// where the native host reads it for the side panel; it is rewritten on every
// run. A daemon outside this repository runs this through the symlink the
// install leaves there, at start and on each change to Bookmarks.plist
// (README.md "Running"), so an edit here shows on the next of those runs.
// Only Safari's top-level lists are exported (Favorites, Bookmarks Menu and the
// folders made beside them), with everything inside them: a bookmark placed at
// the root of Bookmarks, outside all of them, and an empty list are left out.
// Reading ~/Library/Safari needs Full Disk Access for the process that runs this.

import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * Bookmarks.plist as plutil gives it, keeping only the keys read here.
 * @typedef {{
 *   WebBookmarkType?: string,
 *   Title?: string,
 *   URLString?: string,
 *   URIDictionary?: { title?: string },
 *   Children?: Node[],
 * }} Node
 * The shape the side panel reads (extension/panel.js).
 * @typedef {{ title: string, children: Entry[] }} Folder
 * @typedef {{ title: string, url: string }} Bookmark
 * @typedef {Folder | Bookmark} Entry
 */

const plist = join(homedir(), "Library/Safari/Bookmarks.plist");
const defaultOut = join(homedir(), "Library/Application Support/safari-bookmarks/bookmarks.json");

// Safari's own names for its top-level lists, shown as the Safari UI shows them.
/** @type {Record<string, string>} */
const titles = { BookmarksBar: "Favorites", BookmarksMenu: "Bookmarks Menu" };

// The Reading List is a queue to read through, not bookmarks to come back to.
const skipped = new Set(["com.apple.ReadingList"]);

const args = process.argv.slice(2);
if (args.length > 1) fail("usage: export_bookmarks.js [OUT]");
const out = resolve(args[0] ?? defaultOut);

const sections = (readPlist().Children ?? [])
  .filter((n) => n.WebBookmarkType === "WebBookmarkTypeList")
  .filter((n) => !skipped.has(n.Title ?? "") && (n.Children ?? []).length > 0)
  .map((n) => {
    const section = /** @type {Folder} */ (entry(n));
    return { ...section, title: titles[section.title] ?? section.title };
  });

mkdirSync(dirname(out), { recursive: true });
// Write beside the target and rename, so the host never reads half a file.
const tmp = `${out}.tmp`;
writeFileSync(tmp, JSON.stringify({ generated: localNow(), sections }));
renameSync(tmp, out);
console.log(`wrote ${out}`);

/**
 * A folder is {title, children}, a bookmark {title, url}; anything else
 * (Safari's History proxy) is dropped.
 * @param {Node} n
 * @returns {Entry | null}
 */
function entry(n) {
  if (n.WebBookmarkType === "WebBookmarkTypeList") {
    const children = (n.Children ?? []).map(entry).filter((e) => e !== null);
    return { title: n.Title ?? "", children };
  }
  if (n.WebBookmarkType === "WebBookmarkTypeLeaf" && n.URLString !== undefined) {
    return { title: n.URIDictionary?.title ?? n.URLString, url: n.URLString };
  }
  return null;
}

/**
 * plutil's JSON output rejects <data> and <date> values ("Invalid object in
 * plist for JSON format"), so the plist goes through XML, where those values,
 * never shown here, are blanked first. The <data> blobs (iCloud sync records)
 * are also most of the file.
 * @returns {Node}
 */
function readPlist() {
  try {
    const xml = execFileSync("plutil", ["-convert", "xml1", "-o", "-", plist], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).replace(/<(data|date)>.*?<\/\1>/gs, "<string/>");
    const json = execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], {
      input: xml,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
    return JSON.parse(json);
  } catch (e) {
    const stderr = /** @type {{ stderr?: unknown }} */ (e).stderr;
    fail(`cannot read ${plist}: ${String(stderr ?? e).trim()}`);
  }
}

/** The local time to the second, as the Elixir exporter wrote it: 2026-11-04T20:05:00. */
function localNow() {
  const d = new Date();
  const p = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(message);
  process.exit(1);
}
