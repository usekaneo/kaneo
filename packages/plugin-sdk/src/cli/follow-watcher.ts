import { errorMessage } from "./errors/error-message.js";

export type WatchTarget = "node" | "web";

export type WatchUpdate = {
  readonly target: WatchTarget;
  readonly error: string | null;
};

type WatcherEvent = {
  code: string;
  error?: unknown;
  result?: { close?: () => unknown };
};

export type Watcher = {
  on(event: "event", listener: (event: WatcherEvent) => void): unknown;
  close?: () => unknown;
};

export function isWatcher(value: unknown): value is Watcher {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { on?: unknown }).on === "function"
  );
}

export function followWatcher(
  watcher: Watcher,
  target: WatchTarget,
  report: (update: WatchUpdate) => void,
): void {
  let failed = false;
  watcher.on("event", (event) => {
    if (event.code === "START") failed = false;
    if (event.code === "BUNDLE_END" || event.code === "ERROR")
      void event.result?.close?.();
    if (event.code === "ERROR") {
      failed = true;
      report({ target, error: errorMessage(event.error) });
    }
    if (event.code === "END" && !failed) report({ target, error: null });
  });
}
