const STYLE_ID = "quackback-widget-styles";

// The panel CSS is side-specific (corner offset + transform origin), so the
// element is rewritten when the side changes after creation — e.g. the server
// config's position landing after an idle-time panel preload.
let currentSide: "left" | "right" | null = null;

export function ensureStyles(side: "left" | "right"): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing && currentSide === side) return;
  currentSide = side;
  const el = existing ?? document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = [
    ".quackback-panel{position:fixed;z-index:2147483647;overflow:hidden;pointer-events:none;",
    `bottom:16px;${side}:16px;width:384px;height:min(760px,calc(100dvh - 32px));`,
    "box-sizing:border-box;border:1px solid rgba(0,0,0,.08);border-radius:20px;box-shadow:0 18px 40px -16px rgba(40,38,36,.16),0 4px 16px -8px rgba(40,38,36,.08);",
    `opacity:0;transform:scale(0);transform-origin:bottom ${side};`,
    "transition:opacity 280ms cubic-bezier(0.34,1.56,0.64,1),transform 280ms cubic-bezier(0.34,1.56,0.64,1),",
    "width 520ms cubic-bezier(0.26,1,0.32,1),height 520ms cubic-bezier(0.26,1,0.32,1)}",
    // Long-form content (articles and changelog entries) grows the panel.
    // Desktop-scoped: on mobile the panel is already full-screen, and this
    // higher-specificity rule would otherwise SHRINK it there.
    "@media(min-width:761px){.quackback-panel.quackback-expanded{width:min(480px,calc(100vw - 32px));height:min(860px,calc(100dvh - 32px))}}",
    ".quackback-panel.quackback-open{opacity:1;transform:scale(1);pointer-events:auto}",
    ".quackback-panel-close{position:absolute;top:12px;right:14px;width:32px;height:32px;border:0;border-radius:50%;background:#fff;color:#848281;display:grid;place-items:center;cursor:pointer}",
    ".quackback-panel.quackback-closing{opacity:0;transform:scale(0);pointer-events:none;",
    "transition:opacity 200ms cubic-bezier(0.4,0,1,1),transform 200ms cubic-bezier(0.4,0,1,1)}",
    "@media(max-width:760px){",
    ".quackback-panel{top:0;left:0;right:0;bottom:0;width:100%;height:100vh;height:100dvh;",
    "border:0;border-radius:0;box-shadow:none;",
    "opacity:1;visibility:hidden;transform:translateY(100%);transform-origin:center;",
    "transition:transform 300ms cubic-bezier(0.4,0,0.2,1),visibility 0s linear 300ms}",
    ".quackback-panel.quackback-open{transform:translateY(0);visibility:visible;transition:transform 300ms cubic-bezier(0.4,0,0.2,1),visibility 0s linear 0s}",
    ".quackback-panel.quackback-closing{transform:translateY(100%);visibility:hidden;transition:transform 200ms cubic-bezier(0.4,0,1,1),visibility 0s linear 200ms}}",
    ".quackback-backdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.4);",
    "opacity:0;pointer-events:none;transition:opacity 200ms ease}",
    ".quackback-backdrop.quackback-open{opacity:1;pointer-events:auto}",
    "@media(min-width:761px){.quackback-backdrop{display:none!important}}",
    "@media(prefers-reduced-motion:reduce){.quackback-panel,.quackback-backdrop,.quackback-launcher,.quackback-launcher *{transition:none!important}.quackback-launcher{transform:none!important}}",
  ].join("");
  if (!existing) document.head.appendChild(el);
}

export function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
  currentSide = null;
}
