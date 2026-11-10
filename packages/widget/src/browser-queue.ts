/**
 * IIFE entry for script-tag users.
 *
 * The inline snippet on the host page creates a stub `window.Quackback` that
 * pushes every call into a queue. This module replaces that stub with a live
 * dispatcher backed by `createSDK`, then replays anything already queued.
 *
 * The server-generated `/api/widget/sdk.js` prepends a line that sets
 * `window.__QUACKBACK_URL__` (and `window.__QUACKBACK_CONFIG__`, the baked
 * server config that lets the SDK skip the config fetch — see core/sdk.ts).
 * Script-tag installs therefore omit `instanceUrl` from their init options —
 * we fold the baked URL into every init that doesn't carry one of its own. If
 * no init happens at all (a bare `<script src>` with no `Quackback("init")`
 * call), we auto-dispatch one so the widget still boots.
 */
import { createSDK } from "./core/sdk.js";
import type { ServerConfig } from "./core/config.js";

declare global {
  interface Window {
    Quackback?: ((...args: unknown[]) => unknown) & { q?: IArguments[] };
    __QUACKBACK_URL__?: string;
    __QUACKBACK_CONFIG__?: ServerConfig;
  }
}

const sdk = createSDK();
const w = window;
const bakedUrl = w.__QUACKBACK_URL__;

// Suppresses the deferred fallback once the host has taken explicit control:
// either by initializing (their options take precedence) or by destroying
// (they don't want a default widget spawning later).
let bootSuppressed = false;

function dispatch(command: unknown, a?: unknown, b?: unknown): unknown {
  let options = a;
  if (command === "init" || command === "destroy") bootSuppressed = true;
  if (command === "init" && bakedUrl) {
    const opts =
      a && typeof a === "object" ? (a as Record<string, unknown>) : {};
    if (!opts.instanceUrl) options = { ...opts, instanceUrl: bakedUrl };
  }
  return sdk.dispatch(command as "init", options, b);
}

// Capture any queued calls from the inline snippet before we overwrite Quackback.
const queued: IArguments[] = Array.from(w.Quackback?.q ?? []);

// Replace the queue stub with a live dispatcher.
w.Quackback = function (...args: unknown[]) {
  return dispatch(args[0], args[1], args[2]);
};

// Replay any queued commands.
for (const args of queued) {
  const a = args as unknown as unknown[];
  dispatch(a[0], a[1], a[2]);
}

// Deferred so an explicit `Quackback("init", ...)` from host code can pre-empt
// the default-options fallback.
if (bakedUrl) {
  setTimeout(() => {
    if (!bootSuppressed) dispatch("init", {});
  }, 0);
}
