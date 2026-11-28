import { findClosing, skipWhitespace } from "./brackets.js";

export type Span = { open: number; close: number };

const DEFINE_CONFIG = /(?<![\w$.])defineConfig\s*(?:<[^<>()]*>\s*)?\(/g;
const EXPORT_DEFAULT_OBJECT = /(?<![\w$.])export\s+default\s*\{/g;

function objectAfterCall(masked: string, callEnd: number): number | null {
  const start = skipWhitespace(masked, callEnd);
  return masked.charAt(start) === "{" ? start : null;
}

export function findConfigObject(masked: string): Span | string {
  const calls = [...masked.matchAll(DEFINE_CONFIG)];
  let open: number | null;
  if (calls.length > 1) return "it calls defineConfig() more than once";
  const [call] = calls;
  if (call) {
    open = objectAfterCall(masked, call.index + call[0].length);
    if (open === null) {
      return "defineConfig() is not called with an object literal";
    }
  } else {
    const exports = [...masked.matchAll(EXPORT_DEFAULT_OBJECT)];
    const [only] = exports;
    if (exports.length !== 1 || !only) {
      return "it has no defineConfig({ ... }) call";
    }
    open = only.index + only[0].length - 1;
  }
  const close = findClosing(masked, open);
  if (close === null) return "its brackets do not match";
  return { open, close };
}
