import { findClosing, skipWhitespace } from "./brackets.js";
import type { Span } from "./find-config-object.js";

export type PluginsProperty =
  | { kind: "missing" }
  | ({ kind: "array" } & Span)
  | { kind: "unsupported"; reason: string };

function readKey(
  source: string,
  masked: string,
  index: number,
): { name: string; end: number } | null {
  const char = masked.charAt(index);
  if (char === '"' || char === "'") {
    const end = masked.indexOf(char, index + 1);
    return end === -1
      ? null
      : { name: source.slice(index + 1, end), end: end + 1 };
  }
  const identifier = /^[A-Za-z_$][\w$]*/.exec(masked.slice(index));
  return identifier
    ? { name: identifier[0], end: index + identifier[0].length }
    : null;
}

function unsupported(reason: string): PluginsProperty {
  return { kind: "unsupported", reason };
}

export function findPluginsArray(
  source: string,
  masked: string,
  object: Span,
): PluginsProperty {
  const colons: number[] = [];
  let depth = 0;
  let expectKey = true;
  for (let index = object.open + 1; index < object.close; index++) {
    const char = masked.charAt(index);
    if (depth === 0 && expectKey && !/\s/.test(char)) {
      expectKey = false;
      if (masked.startsWith("...", index)) {
        return unsupported("the config object spreads another object");
      }
      const key = readKey(source, masked, index);
      if (key?.name === "plugins") {
        const colon = skipWhitespace(masked, key.end);
        if (masked.charAt(colon) !== ":") {
          return unsupported("plugins is not a plain property");
        }
        colons.push(colon);
      }
    }
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) expectKey = true;
  }

  const [colon] = colons;
  if (colon === undefined) return { kind: "missing" };
  if (colons.length > 1) return unsupported("plugins is set more than once");
  const open = skipWhitespace(masked, colon + 1);
  if (masked.charAt(open) !== "[") {
    return unsupported("plugins is not an array literal");
  }
  const close = findClosing(masked, open);
  if (close === null) return unsupported("its brackets do not match");
  return { kind: "array", open, close };
}
