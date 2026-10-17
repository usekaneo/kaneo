export function normalizeComment(text: string): string {
  return text.replace(/^(?:[ \t]*\r?\n)+/u, "").trimEnd();
}

export function firstLine(text: string): {
  readonly line: string;
  readonly more: boolean;
} {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return { line: lines[0] ?? "", more: lines.length > 1 };
}
