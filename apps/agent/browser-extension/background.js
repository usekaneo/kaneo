// Kaneo Agent connector.
//
// Tells the Kaneo Agent on this computer which website domain is in the active
// tab of the focused browser window. Only the hostname leaves this script
// (e.g. "github.com"), and only to the local agent over native messaging.
// Paths, queries, titles, page contents and incognito windows are never read
// or sent.

const HOST = "app.kaneo.agent";
const HEARTBEAT = "kaneo-heartbeat";
const BROWSER = navigator.userAgent.includes("Edg/") ? "edge" : "chrome";
const HOSTNAME = /^[a-z0-9.-]{1,253}$/;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const WINDOW_TYPES = ["normal", "popup", "panel", "app", "devtools"];

let port = null;
let failures = 0;
let nextAttemptAt = 0;
let loggedMissingHost = false;

/** Hostname of an http(s) URL, lowercased, without "www."; otherwise null. */
function domainOf(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  let host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("www.")) host = host.slice(4);
  return HOSTNAME.test(host) ? host : null;
}

/** Domain of the active tab in the focused normal window, or null. */
async function currentDomain() {
  let win;
  try {
    win = await chrome.windows.getLastFocused({ windowTypes: WINDOW_TYPES });
  } catch {
    return { focused: false, domain: null };
  }
  if (!win || !win.focused) return { focused: false, domain: null };
  // Incognito is excluded by the manifest ("incognito": "not_allowed"); the
  // check stays as a second guard.
  if (win.type !== "normal" || win.incognito) return { focused: true, domain: null };
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab || tab.incognito) return { focused: true, domain: null };
  return { focused: true, domain: domainOf(tab.url) };
}

function connect() {
  if (port) return port;
  if (Date.now() < nextAttemptAt) return null;
  try {
    port = chrome.runtime.connectNative(HOST);
  } catch (error) {
    scheduleRetry(error && error.message);
    return null;
  }
  port.onMessage.addListener((message) => {
    if (message && message.type === "ack") {
      failures = 0;
      loggedMissingHost = false;
    }
  });
  port.onDisconnect.addListener(() => {
    const reason = chrome.runtime.lastError && chrome.runtime.lastError.message;
    port = null;
    scheduleRetry(reason);
  });
  return port;
}

function scheduleRetry(reason) {
  failures += 1;
  nextAttemptAt = Date.now() + Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(failures, 9));
  if (!loggedMissingHost) {
    loggedMissingHost = true;
    console.info(
      "Kaneo Agent is not reachable; domains are not shared until it runs.",
      reason || "",
    );
  }
}

async function report() {
  const { focused, domain } = await currentDomain();
  const message = { type: "domain", domain, browser: BROWSER, at: new Date().toISOString() };
  const target = connect();
  if (target) {
    try {
      target.postMessage(message);
    } catch {
      port = null;
    }
  }
  // Heartbeat only while a browser window has focus; the agent treats a
  // domain older than 60 s as unknown.
  if (focused) {
    chrome.alarms.get(HEARTBEAT, (alarm) => {
      if (!alarm) chrome.alarms.create(HEARTBEAT, { periodInMinutes: 0.5 });
    });
  } else {
    chrome.alarms.clear(HEARTBEAT);
  }
}

chrome.tabs.onActivated.addListener(() => report());
chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
  if (change.url && tab.active) report();
});
chrome.windows.onFocusChanged.addListener(() => report(), { windowTypes: WINDOW_TYPES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT) report();
});
chrome.runtime.onStartup.addListener(() => report());
chrome.runtime.onInstalled.addListener(() => report());
