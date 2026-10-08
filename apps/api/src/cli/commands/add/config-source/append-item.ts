import type { Edit } from "./edits";
import type { Span } from "./find-config-object";

function lineIndent(source: string, index: number): string {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  return /^[ \t]*/.exec(source.slice(start))?.[0] ?? "";
}

function lastCodeIndex(masked: string, { open, close }: Span): number {
  for (let index = close - 1; index > open; index--) {
    if (!/\s/.test(masked.charAt(index))) return index;
  }
  return -1;
}

function childIndent(source: string, close: number): string {
  const indent = lineIndent(source, close);
  return `${indent}${indent.includes("\t") ? "\t" : "  "}`;
}

export function appendItem(
  source: string,
  masked: string,
  span: Span,
  item: string,
  padding: string,
): Edit[] {
  const { open, close } = span;
  const multiline = source.slice(open, close).includes("\n");
  const last = lastCodeIndex(masked, span);

  if (last === -1) {
    if (multiline) {
      return [
        { at: open + 1, text: `\n${childIndent(source, close)}${item},` },
      ];
    }
    if (source.slice(open + 1, close).trim() === "") {
      return [
        { at: open + 1, end: close, text: `${padding}${item}${padding}` },
      ];
    }
    return [{ at: open + 1, text: `${item}, ` }];
  }

  const trailingComma = masked.charAt(last) === ",";
  if (!multiline) {
    return [{ at: last + 1, text: trailingComma ? ` ${item},` : `, ${item}` }];
  }

  const indent = lineIndent(source, last);
  const newline = source.indexOf("\n", last);
  const at = newline === -1 || newline > close ? close : newline;
  if (trailingComma) return [{ at, text: `\n${indent}${item},` }];
  if (at === last + 1) return [{ at, text: `,\n${indent}${item}` }];
  return [
    { at, text: `\n${indent}${item}` },
    { at: last + 1, text: "," },
  ];
}
