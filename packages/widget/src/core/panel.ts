import { ensureStyles } from "./style.js";
import { X } from "../icons/phosphor.js";

export interface PanelOptions {
  /** Widget URL — e.g. "https://feedback.acme.com/widget". */
  widgetUrl: string;
  placement: "left" | "right";
  defaultBoard?: string;
  showCloseButton?: boolean;
  locale?: string;
  onBackdropClick: () => void;
}

export interface PanelHandle {
  iframe: HTMLIFrameElement;
  show(): void;
  hide(): void;
  /** Grow/shrink the panel for long-form content (transitioned via CSS). */
  setExpanded(expanded: boolean): void;
  /** Move the panel between bottom corners (rewrites the side-specific CSS). */
  setPlacement(side: "left" | "right"): void;
  /** The loaded iframe owns its close control; keep a host fallback until then. */
  markReady(): void;
  destroy(): void;
}

/** The frame's accessible name, in the visitor's language where known. */
const FRAME_TITLE: Record<string, string> = {
  ar: "مساعدة",
  de: "Hilfe",
  es: "Ayuda",
  fr: "Aide",
  pl: "Pomoc",
  pt: "Ajuda",
  ru: "Помощь",
  uk: "Допомога",
  zh: "帮助",
  "zh-tw": "說明",
};

function frameTitle(locale: string | undefined): string {
  const tag = (locale ?? "").toLowerCase();
  return FRAME_TITLE[tag] ?? FRAME_TITLE[tag.split("-")[0]!] ?? "Help";
}

export function createPanel(opts: PanelOptions): PanelHandle {
  ensureStyles(opts.placement);

  const params: string[] = [];
  if (opts.defaultBoard)
    params.push(`board=${encodeURIComponent(opts.defaultBoard)}`);
  if (opts.showCloseButton) params.push("showClose=1");
  if (opts.locale) params.push(`locale=${encodeURIComponent(opts.locale)}`);
  const url = opts.widgetUrl + (params.length ? "?" + params.join("&") : "");

  const backdrop = document.createElement("div");
  backdrop.className = "quackback-backdrop";
  const listeners = new AbortController();
  backdrop.addEventListener("click", opts.onBackdropClick, {
    signal: listeners.signal,
  });
  document.body.appendChild(backdrop);

  const panel = document.createElement("div");
  panel.className = "quackback-panel quackback-widget-iframe-wrapper";
  // Closed, the panel is only transparent: inert keeps its frame out of the
  // host page's tab order and the accessibility tree until it opens.
  panel.inert = true;
  document.body.appendChild(panel);

  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    width: "100%",
    height: "100%",
    border: "none",
    colorScheme: "normal",
  });
  iframe.setAttribute("src", url);
  iframe.setAttribute("title", frameTitle(opts.locale));
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-same-origin allow-popups allow-downloads",
  );
  iframe.setAttribute("allow", "clipboard-write");
  iframe.className = "quackback-widget-iframe";
  panel.appendChild(iframe);

  const fallbackClose = document.createElement("button");
  fallbackClose.type = "button";
  fallbackClose.className = "quackback-panel-close";
  fallbackClose.setAttribute("aria-label", "Close feedback widget");
  fallbackClose.innerHTML = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="${X}"/></svg>`;
  fallbackClose.addEventListener("click", opts.onBackdropClick, {
    signal: listeners.signal,
  });
  panel.appendChild(fallbackClose);

  let open = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let previousFocus: HTMLElement | null = null;
  const restoreFocus = () => {
    if (panel.contains(document.activeElement) && previousFocus?.isConnected)
      previousFocus.focus();
    previousFocus = null;
  };
  document.addEventListener(
    "keydown",
    (event) => {
      if (open && event.key === "Escape") opts.onBackdropClick();
    },
    { signal: listeners.signal },
  );

  return {
    iframe,
    show() {
      if (open) return;
      open = true;
      clearTimeout(closeTimer);
      previousFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      panel.inert = false;
      panel.classList.remove("quackback-closing");
      backdrop.classList.remove("quackback-closing");
      void panel.offsetHeight; // force reflow
      panel.classList.add("quackback-open");
      backdrop.classList.add("quackback-open");
      iframe.focus();
    },
    hide() {
      if (!open) return;
      open = false;
      restoreFocus();
      clearTimeout(closeTimer);
      panel.inert = true;
      panel.classList.remove("quackback-open");
      panel.classList.add("quackback-closing");
      backdrop.classList.remove("quackback-open");
      backdrop.classList.add("quackback-closing");
      closeTimer = setTimeout(() => {
        panel.classList.remove("quackback-closing");
        backdrop.classList.remove("quackback-closing");
      }, 300);
    },
    setExpanded(expanded) {
      panel.classList.toggle("quackback-expanded", expanded);
    },
    setPlacement(side) {
      ensureStyles(side);
    },
    markReady() {
      if (document.activeElement === fallbackClose) iframe.focus();
      fallbackClose.remove();
    },
    destroy() {
      clearTimeout(closeTimer);
      listeners.abort();
      restoreFocus();
      panel.remove();
      backdrop.remove();
    },
  };
}
