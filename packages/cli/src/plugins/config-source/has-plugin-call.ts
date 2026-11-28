import { depthAt, findClosing, skipWhitespace } from "./brackets.js";

export function hasPluginCall(array: string, importName: string): boolean {
  const entry = /(?:^|,)\s*([A-Za-z_$][\w$]*)\s*\(/g;
  for (const match of array.matchAll(entry)) {
    if (match[1] !== importName || depthAt(array, match.index) !== 0) continue;
    const close = findClosing(array, match.index + match[0].length - 1);
    if (close === null) continue;
    const end = skipWhitespace(array, close + 1);
    if (end === array.length || array.charAt(end) === ",") return true;
  }
  return false;
}
