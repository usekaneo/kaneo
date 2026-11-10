import { ensureStyles } from "./style.js";
import { CHAT_CIRCLE, X } from "../icons/phosphor.js";

export interface LauncherOptions {
  placement: "left" | "right";
  onClick: () => void;
  /**
   * Mount the button (and greeting) inside this element with absolute
   * positioning. Used by the admin live preview so the real launcher sits in
   * the fake page instead of `position: fixed` on the viewport.
   */
  root?: HTMLElement;
}

export interface LauncherHandle {
  el: HTMLButtonElement;
  setOpen(open: boolean): void;
  /** Replace the button colors (typically called after server config fetch). */
  setColors(colors: {
    backgroundColor?: string;
    foregroundColor?: string;
  }): void;
  /** Show an unread-count badge on the button (hidden at 0). Driven by the
   *  iframe's `quackback:unread` messages so a visitor sees waiting replies
   *  without opening the widget. */
  setUnread(count: number): void;
  /** Proactive greeting bubble beside the button (empty/unset hides it). Shown
   *  only while closed and not dismissed this browser session; clicking it opens
   *  the widget. Driven by the server config. */
  setGreeting(text: string | null | undefined): void;
  /** Text label beside the icon — turns the circular button into a pill.
   *  Empty/unset restores the icon-only circle. Driven by the server config. */
  setLabel(text: string | null | undefined): void;
  /** Move the button (and its greeting bubble) between bottom corners. */
  setPlacement(side: "left" | "right"): void;
  /** Fade the button in. Called after initial colors are set to avoid a color flash. */
  reveal(): void;
  remove(): void;
}

// Default launcher colors — shown briefly before the server theme fetch
// completes, or as the permanent colors if the fetch fails.
const DEFAULT_BG = "#ffffff";
const DEFAULT_FG = "#171717";

const MESSENGER_ICON = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="${CHAT_CIRCLE}"/></svg>`;

export function createLauncher(opts: LauncherOptions): LauncherHandle {
  ensureStyles(opts.placement);
  const listeners = new AbortController();
  const listen = { signal: listeners.signal };
  let bg = DEFAULT_BG;
  let fg = DEFAULT_FG;
  // Unread counts only need attention while the widget is closed.
  let unreadCount = 0;
  let isOpen = false;
  let revealed = false;
  // Visible button label — when set, it doubles as the accessible name.
  let labelText = "";
  // Proactive greeting bubble state. Dismissal persists per browser session so
  // the bubble invites once without nagging on every page. A contained preview
  // must not write that key — it would hide the bubble for a later host visit.
  let greetingText: string | null = null;
  let localDismissed = false;
  const contained = Boolean(opts.root);
  const edge = contained ? "0px" : "20px";
  const GREETING_DISMISS_KEY = "quackback:launcher-greeting-dismissed";
  const greetingDismissed = (): boolean => {
    if (contained) return localDismissed;
    try {
      return sessionStorage.getItem(GREETING_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  };

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "quackback-launcher";
  btn.inert = true;
  Object.assign(btn.style, {
    position: contained ? "absolute" : "fixed",
    bottom: contained ? "0px" : "20px",
    [opts.placement === "left" ? "left" : "right"]: edge,
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    padding: "0",
    border: "none",
    borderRadius: "50%",
    backgroundColor: bg,
    color: fg,
    fontSize: "14px",
    fontWeight: "600",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    cursor: "pointer",
    boxShadow:
      "inset 0 0 0 .5px rgba(0,0,0,.13), 0 1px 1.5px rgba(0,0,0,.04), 0 8px 16px rgba(0,0,0,.05)",
    opacity: "0",
    transition:
      "opacity 450ms ease, background-color 200ms cubic-bezier(0.32,0.72,0,1), transform 150ms ease-out",
  });
  btn.setAttribute("aria-label", "Open feedback widget");
  btn.setAttribute("aria-expanded", "false");

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "relative",
    display: "flex",
    width: "22px",
    height: "22px",
    flexShrink: "0",
  });

  wrapper.innerHTML = MESSENGER_ICON;
  btn.appendChild(wrapper);

  // Optional text label next to the icon. Hidden until setLabel arrives with
  // the server config; the badge stays the last child either way.
  const labelSpan = document.createElement("span");
  Object.assign(labelSpan.style, {
    display: "none",
    maxWidth: "180px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
  btn.appendChild(labelSpan);

  // Unread-count badge, top-right of the button. Its own colors (not the theme
  // fg/bg) so it always reads as an alert against any launcher color.
  const badge = document.createElement("span");
  Object.assign(badge.style, {
    position: "absolute",
    top: "-2px",
    right: "-2px",
    display: "none",
    minWidth: "20px",
    height: "20px",
    padding: "0 5px",
    boxSizing: "border-box",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    backgroundColor: "#ef4444",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: "700",
    lineHeight: "1",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.9)",
    pointerEvents: "none",
  });
  btn.appendChild(badge);

  const renderBadge = () => {
    const show = unreadCount > 0 && !isOpen;
    badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    badge.style.display = show ? "flex" : "none";
  };

  // Proactive greeting bubble — a fixed card sitting just above the button on
  // the same side. Clicking the text opens the widget; the × dismisses it for
  // the session. Its own light card colors so it reads over any launcher color.
  const side = opts.placement === "left" ? "left" : "right";
  const bubble = document.createElement("div");
  Object.assign(bubble.style, {
    position: contained ? "absolute" : "fixed",
    bottom: "84px",
    [side]: edge,
    zIndex: "2147483646",
    display: "none",
    alignItems: "center",
    gap: "8px",
    maxWidth: "260px",
    padding: "10px 12px",
    borderRadius: "14px",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "13px",
    lineHeight: "1.35",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxShadow: "0 12px 32px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.12)",
  });
  const bubbleText = document.createElement("button");
  bubbleText.type = "button";
  Object.assign(bubbleText.style, {
    cursor: "pointer",
    flex: "1",
    border: "none",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "start",
    padding: "0",
  });
  bubbleText.addEventListener("click", opts.onClick, listen);
  const bubbleClose = document.createElement("button");
  bubbleClose.type = "button";
  bubbleClose.setAttribute("aria-label", "Dismiss");
  bubbleClose.innerHTML = `<svg aria-hidden="true" width="12" height="12" viewBox="0 0 256 256" fill="currentColor"><path d="${X}"/></svg>`;
  Object.assign(bubbleClose.style, {
    flexShrink: "0",
    width: "18px",
    height: "18px",
    padding: "0",
    border: "none",
    borderRadius: "50%",
    background: "transparent",
    color: "#9ca3af",
    fontSize: "16px",
    lineHeight: "1",
    cursor: "pointer",
  });
  const renderGreeting = () => {
    const show = !!greetingText && !isOpen && !greetingDismissed();
    bubble.style.display = show ? "flex" : "none";
  };
  bubbleClose.addEventListener(
    "click",
    () => {
      if (contained) {
        localDismissed = true;
      } else {
        try {
          sessionStorage.setItem(GREETING_DISMISS_KEY, "1");
        } catch {
          /* private mode — dismiss for this page load only */
          greetingText = null;
        }
      }
      renderGreeting();
    },
    listen,
  );
  bubble.appendChild(bubbleText);
  bubble.appendChild(bubbleClose);
  const mount = opts.root ?? document.body;
  mount.appendChild(bubble);

  btn.addEventListener("click", opts.onClick, listen);

  mount.appendChild(btn);

  return {
    el: btn,
    setOpen(open) {
      isOpen = open;
      btn.style.visibility = open ? "hidden" : "visible";
      btn.inert = !revealed || open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        open ? "Close feedback widget" : labelText || "Open feedback widget",
      );
      renderBadge();
      renderGreeting();
    },
    setColors(colors) {
      if (colors.backgroundColor) {
        bg = colors.backgroundColor;
        btn.style.backgroundColor = bg;
      }
      if (colors.foregroundColor) {
        fg = colors.foregroundColor;
        btn.style.color = fg;
      }
    },
    setUnread(count) {
      unreadCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
      renderBadge();
    },
    setGreeting(text) {
      const next = text?.trim() || null;
      if (contained && next !== greetingText) localDismissed = false;
      greetingText = next;
      bubbleText.textContent = greetingText ?? "";
      renderGreeting();
    },
    setLabel(text) {
      labelText = text?.trim() ?? "";
      const show = labelText.length > 0;
      labelSpan.textContent = labelText;
      labelSpan.style.display = show ? "block" : "none";
      // Pill vs. icon-only circle.
      btn.style.width = show ? "auto" : "40px";
      btn.style.borderRadius = show ? "20px" : "50%";
      btn.style.padding = show ? "0 16px 0 10px" : "0";
      btn.style.gap = show ? "8px" : "0";
      if (!isOpen)
        btn.setAttribute("aria-label", labelText || "Open feedback widget");
    },
    setPlacement(side) {
      btn.style.left = side === "left" ? edge : "";
      btn.style.right = side === "right" ? edge : "";
      bubble.style.left = side === "left" ? edge : "";
      bubble.style.right = side === "right" ? edge : "";
    },
    reveal() {
      revealed = true;
      btn.inert = isOpen;
      btn.style.opacity = "1";
    },
    remove() {
      listeners.abort();
      btn.remove();
      bubble.remove();
    },
  };
}
