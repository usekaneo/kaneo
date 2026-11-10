import { privacyOptedOut } from "./privacy.js";

/**
 * Host-page pageview tracker (visitor analytics).
 *
 * Runs in the embedding site's context: reports the host page's URL to the
 * instance's /api/track beacon on load and on SPA navigations (History API
 * patch + popstate/hashchange), deduped on the href actually changing so
 * frameworks that call replaceState repeatedly (scroll restoration and the
 * like) count a page once. Enabled only when the instance's server config
 * says so; honors DNT/GPC; never throws into the host page.
 */

export interface Tracker {
  start(): void;
  stop(): void;
}

export function createTracker(
  instanceUrl: string,
  deviceId: string | null = null,
): Tracker {
  let active = false;
  let lastHref: string | null = null;
  let originalPushState: History["pushState"] | null = null;
  let originalReplaceState: History["replaceState"] | null = null;
  let installedPushState: History["pushState"] | null = null;
  let installedReplaceState: History["replaceState"] | null = null;

  function send(): void {
    if (!active) return;
    try {
      if (privacyOptedOut()) return;
      const href = window.location.href;
      if (href === lastHref) return;
      lastHref = href;
      const body = JSON.stringify({
        url: href,
        referrer: document.referrer,
        surface: "widget",
        ...(deviceId ? { deviceId } : {}),
      });
      if (
        !navigator.sendBeacon ||
        !navigator.sendBeacon(`${instanceUrl}/api/track`, body)
      ) {
        void fetch(`${instanceUrl}/api/track`, {
          method: "POST",
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Analytics must never break the host page.
    }
  }

  return {
    start() {
      if (active || privacyOptedOut()) return;
      active = true;

      const h = window.history;
      const pushState = h.pushState;
      const replaceState = h.replaceState;
      originalPushState = pushState;
      originalReplaceState = replaceState;
      installedPushState = function (
        this: History,
        ...args: Parameters<History["pushState"]>
      ) {
        pushState.apply(this, args);
        send();
      };
      installedReplaceState = function (
        this: History,
        ...args: Parameters<History["replaceState"]>
      ) {
        replaceState.apply(this, args);
        send();
      };
      h.pushState = installedPushState;
      h.replaceState = installedReplaceState;
      window.addEventListener("popstate", send);
      window.addEventListener("hashchange", send);

      send();
    },

    stop() {
      if (!active) return;
      active = false;
      const h = window.history;
      // Restore only if the methods are still ours: if the host site layered
      // its own patch on top after start(), restoring would silently discard
      // it. Leaving our wrapper is safe — send() is a no-op once inactive.
      if (originalPushState && h.pushState === installedPushState) {
        h.pushState = originalPushState;
      }
      if (originalReplaceState && h.replaceState === installedReplaceState) {
        h.replaceState = originalReplaceState;
      }
      originalPushState = null;
      originalReplaceState = null;
      installedPushState = null;
      installedReplaceState = null;
      window.removeEventListener("popstate", send);
      window.removeEventListener("hashchange", send);
      lastHref = null;
    },
  };
}
