/**
 * The shape ../scripts/export_bookmarks.exs writes.
 * @typedef {{ title: string, children: Entry[] }} Folder
 * @typedef {{ title: string, url: string }} Bookmark
 * @typedef {Folder | Bookmark} Entry
 * @typedef {{ generated: string, sections: Folder[] }} Export
 */

const q = byId("q", HTMLInputElement);
const root = byId("bookmarks", HTMLElement);
const status = byId("status", HTMLElement);

// Read on every opening of the panel; a panel left open keeps what it read.
try {
  const res = await fetch("bookmarks.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`bookmarks.json: HTTP ${res.status}`);
  /** @type {Export} */
  const data = await res.json();
  for (const s of data.sections) {
    const section = document.createElement("section");
    section.append(folder(s.title, s.children, true));
    root.append(section);
  }
  status.textContent = `generated ${data.generated.replace("T", " ")}`;
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  status.textContent = `${message}; is the safari-bookmarks daemon running?`;
}

/** @type {[HTMLDetailsElement, boolean][]} */
const folders = [...root.querySelectorAll("details")].map((d) => [d, d.open]);

/**
 * @param {string} title
 * @param {Entry[]} children
 * @param {boolean} open
 */
function folder(title, children, open) {
  const details = document.createElement("details");
  details.open = open;
  const summary = document.createElement("summary");
  summary.textContent = title;
  const ul = document.createElement("ul");
  ul.append(...children.map(item));
  details.append(summary, ul);
  return details;
}

/** @param {Entry} entry */
function item(entry) {
  const li = document.createElement("li");
  if ("children" in entry) {
    li.append(folder(entry.title, entry.children, false));
    return li;
  }
  li.className = "bm";
  li.dataset.k = `${entry.title} ${entry.url}`.toLowerCase();
  li.title = entry.url;
  const host = document.createElement("span");
  host.className = "host";
  // A bookmarklet would run against the page it is opened on, which from
  // here is not the page it was made for, so it is listed without a link.
  if (entry.url.startsWith("javascript:")) {
    li.append(entry.title);
    host.textContent = "bookmarklet";
  } else {
    const a = document.createElement("a");
    a.href = entry.url;
    a.textContent = entry.title;
    li.append(a);
    host.textContent = URL.parse(entry.url)?.host ?? "";
  }
  li.append(host);
  return li;
}

q.addEventListener("input", () => {
  const s = q.value.trim().toLowerCase();
  for (const li of root.querySelectorAll("li.bm")) {
    if (!(li instanceof HTMLElement)) continue;
    li.classList.toggle("hidden", s !== "" && !li.dataset.k?.includes(s));
  }
  // A filter shows only the folders holding a match, opened; an empty one puts
  // every folder back as the panel first showed it.
  for (const [d, initial] of folders) {
    const match = s === "" || d.querySelector("li.bm:not(.hidden)") !== null;
    d.open = s === "" ? initial : match;
    d.parentElement?.classList.toggle("hidden", !match);
  }
});

/** @param {Event} e */
const linkOf = (e) => (e.target instanceof Element ? e.target.closest("a") : null);

// A link left to itself would load inside the panel. A click opens it in the
// current tab, as Chrome's own bookmarks panel does; Cmd-click or a middle
// click opens a background tab.
root.addEventListener("click", (e) => {
  const a = linkOf(e);
  if (!a) return;
  e.preventDefault();
  if (e.metaKey || e.ctrlKey) chrome.tabs.create({ url: a.href, active: false });
  else chrome.tabs.update({ url: a.href });
});
root.addEventListener("auxclick", (e) => {
  const a = linkOf(e);
  if (!a || e.button !== 1) return;
  e.preventDefault();
  chrome.tabs.create({ url: a.href, active: false });
});

// Text size of the bookmark list, kept per browser profile across openings.
const sizes = [11, 12, 13, 14, 15, 16, 18, 20];
let size = Number(localStorage.getItem("size")) || 13;
const applySize = () => {
  root.style.setProperty("--size", `${size}px`);
  localStorage.setItem("size", String(size));
};
/** @param {number} d */
const step = (d) => {
  const i = sizes.indexOf(size);
  size = sizes[Math.min(sizes.length - 1, Math.max(0, (i < 0 ? 2 : i) + d))];
  applySize();
};
byId("smaller", HTMLButtonElement).addEventListener("click", () => step(-1));
byId("larger", HTMLButtonElement).addEventListener("click", () => step(1));
applySize();

// The panel reads bookmarks.json only when it opens; this reads it again.
byId("reload", HTMLButtonElement).addEventListener("click", () => location.reload());

/**
 * The element panel.html gives this id, of the type the code relies on.
 * @template {HTMLElement} T
 * @param {string} id
 * @param {new () => T} type
 * @returns {T}
 */
function byId(id, type) {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`panel.html has no ${type.name} #${id}`);
  return el;
}
