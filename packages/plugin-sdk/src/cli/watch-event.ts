import type { BuiltPlugin } from "./build-result.js";
import type { WatchTarget } from "./follow-watcher.js";
import { renderError } from "./output/render-notice.js";
import type { Theme } from "./output/theme.js";

export type WatchEvent =
  | { readonly event: "watching"; readonly plugin: BuiltPlugin }
  | {
      readonly event: "built";
      readonly target: WatchTarget;
      readonly warnings: ReadonlyArray<string>;
    }
  | {
      readonly event: "error";
      readonly target: WatchTarget;
      readonly error: string;
    };

const TARGET_LABELS: Record<WatchTarget, string> = {
  node: "server entries",
  web: "web entry",
};

export function renderWatchEvent(theme: Theme, event: WatchEvent): string {
  switch (event.event) {
    case "watching":
      return "Watching for changes. Press Ctrl+C to stop.";
    case "built":
      return theme.success(`Built ${TARGET_LABELS[event.target]}`);
    case "error":
      return renderError(theme, event.error);
  }
}
