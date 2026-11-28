import { depthAt, findClosing } from "./brackets.js";

export type LastImport =
  | { kind: "none" }
  | { kind: "found"; end: number; quote: string; semicolon: boolean }
  | { kind: "invalid" };

const IMPORT = /(?<![\w$.])import(?=[\s{*"'])/g;
const ATTRIBUTES = /^\s*(?:with|assert)\s*\{/;
const SEMICOLON = /^[ \t]*;/;

export function findLastImport(masked: string): LastImport {
  let last: LastImport = { kind: "none" };
  for (const match of masked.matchAll(IMPORT)) {
    if (depthAt(masked, match.index) !== 0) continue;
    const rest = masked.slice(match.index);
    const quoteOffset = rest.search(/["']/);
    if (quoteOffset === -1) return { kind: "invalid" };
    if (/[;()=]/.test(rest.slice(0, quoteOffset))) continue;
    const quoteAt = match.index + quoteOffset;
    const quote = masked.charAt(quoteAt);
    const closeAt = masked.indexOf(quote, quoteAt + 1);
    if (closeAt === -1) return { kind: "invalid" };
    let end = closeAt + 1;
    const attributes = ATTRIBUTES.exec(masked.slice(end));
    if (attributes) {
      const brace = findClosing(masked, end + attributes[0].length - 1);
      if (brace === null) return { kind: "invalid" };
      end = brace + 1;
    }
    const semicolon = SEMICOLON.exec(masked.slice(end));
    if (semicolon) end += semicolon[0].length;
    last = { kind: "found", end, quote, semicolon: Boolean(semicolon) };
  }
  return last;
}
