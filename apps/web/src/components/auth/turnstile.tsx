import { useEffect, useRef } from "react";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ATTR = "data-kaneo-turnstile";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible" | "invisible";
          "refresh-expired"?: "auto" | "manual" | "never";
          "refresh-timeout"?: "auto" | "manual" | "never";
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  const existing = document.querySelector<HTMLScriptElement>(
    `script[${SCRIPT_ATTR}]`,
  );
  if (existing) {
    scriptPromise = new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(), { once: true });
    });
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.setAttribute(SCRIPT_ATTR, "");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileProps = {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: "light" | "dark" | "auto";
};

export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  onError,
  theme = "auto",
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Hold the latest callbacks in refs so the effect doesn't re-run (and
  // tear down + re-render the iframe) when the parent passes new function
  // identities. Without this, every parent re-render rebuilt the widget.
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onVerifyRef.current(token),
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => onErrorRef.current?.(),
          theme,
          size: "flexible",
          // Don't silently re-challenge on focus regain / timeout. The widget
          // keeps the verified token until it actually expires (Cloudflare's
          // 300s window); on expiry the `expired-callback` clears parent
          // state and the user clicks once to re-verify.
          "refresh-expired": "manual",
          "refresh-timeout": "manual",
        });
      })
      .catch(() => onErrorRef.current?.());
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme]);

  return <div ref={containerRef} className="w-full" />;
}
