const CLOSERS = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
]);
const CLOSING = new Set(CLOSERS.values());

export function findClosing(masked: string, open: number): number | null {
  const expected: string[] = [];
  for (let index = open; index < masked.length; index++) {
    const char = masked.charAt(index);
    const closer = CLOSERS.get(char);
    if (closer) {
      expected.push(closer);
    } else if (CLOSING.has(char)) {
      if (expected.pop() !== char) return null;
      if (expected.length === 0) return index;
    }
  }
  return null;
}

export function depthAt(masked: string, position: number): number {
  let depth = 0;
  for (let index = 0; index < position; index++) {
    const char = masked.charAt(index);
    if (CLOSERS.has(char)) depth += 1;
    else if (CLOSING.has(char)) depth -= 1;
  }
  return depth;
}

export function skipWhitespace(masked: string, from: number): number {
  let index = from;
  while (index < masked.length && /\s/.test(masked.charAt(index))) index += 1;
  return index;
}
