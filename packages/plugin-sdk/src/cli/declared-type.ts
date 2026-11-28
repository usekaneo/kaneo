const OPENERS = "{([<";
const CLOSERS = "})]";
const QUOTES = "\"'`";

export function readDeclaredType(source: string, name: string): string | null {
  const marker = `export declare const ${name}: `;
  const start = source.indexOf(marker);
  if (start === -1) return null;

  const from = start + marker.length;
  let depth = 0;
  let quote = "";
  for (let index = from; index < source.length; index += 1) {
    const char = source.charAt(index);
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
    } else if (QUOTES.includes(char)) {
      quote = char;
    } else if (OPENERS.includes(char)) {
      depth += 1;
    } else if (
      CLOSERS.includes(char) ||
      (char === ">" && source.charAt(index - 1) !== "=")
    ) {
      depth -= 1;
    } else if (char === ";" && depth === 0) {
      return source.slice(from, index).trim();
    }
  }
  return null;
}
