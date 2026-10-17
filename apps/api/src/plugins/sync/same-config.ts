import { isDeepStrictEqual } from "node:util";

export function sameConfig(stored: string, expected: string): boolean {
  try {
    return isDeepStrictEqual(JSON.parse(stored), JSON.parse(expected));
  } catch {
    return false;
  }
}
