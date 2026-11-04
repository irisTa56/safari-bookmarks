// The native host (../scripts/open_in_safari_host.sh) runs `open -a Safari`.
// Safari's own x-safari-https scheme would need no host, but it makes Safari
// show its default-browser banner on every handoff and turns http into https.
const host = "local.safari_bookmarks.open_in_safari";
const web = ["http://*/*", "https://*/*"];

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  // Items survive a reload of the extension, and creating an existing id fails.
  // Only web pages and links are offered: Safari can open nothing else, and the
  // side panel's own links are Safari's bookmarks already.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "page",
      title: "Open Page in Safari",
      contexts: ["page"],
      documentUrlPatterns: web,
    });
    chrome.contextMenus.create({
      id: "link",
      title: "Open Link in Safari",
      contexts: ["link"],
      documentUrlPatterns: web,
      targetUrlPatterns: web,
    });
  });
});

// A failed handoff marks the toolbar icon, whose tooltip says why; otherwise
// the menu item would just do nothing.
chrome.contextMenus.onClicked.addListener(async (info) => {
  const url = info.menuItemId === "link" ? info.linkUrl : info.pageUrl;
  try {
    const res = await chrome.runtime.sendNativeMessage(host, { url });
    if (!res?.ok) throw new Error(res?.error ?? "no reply");
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "Safari Bookmarks" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setTitle({
      title: `Open in Safari failed: ${message}. Is the host installed (mise run install:host)?`,
    });
  }
});
