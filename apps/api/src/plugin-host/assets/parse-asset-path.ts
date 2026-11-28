import { pluginPathRest } from "../plugin-path";

const UNSAFE_CHARACTERS = /[\\/\0]/;

export function parseAssetPath(pathname: string): string[] | null {
  const rest = pluginPathRest(pathname);
  if (rest?.[0] !== "assets" || rest.length < 2) return null;

  const segments: string[] = [];
  for (const segment of rest.slice(1)) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (
      !decoded ||
      decoded.startsWith(".") ||
      UNSAFE_CHARACTERS.test(decoded)
    ) {
      return null;
    }
    segments.push(decoded);
  }
  return segments;
}
