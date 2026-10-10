import { fileURLToPath } from "node:url";

function toPath(url: string): string {
  try {
    return fileURLToPath(url);
  } catch {
    return url;
  }
}

export function guessPackageName(url: string): string {
  const parts = toPath(url).split(/[\\/]/);
  const index = parts.lastIndexOf("node_modules");
  const first = index === -1 ? undefined : parts[index + 1];
  if (!first) return url;
  const second = parts[index + 2];
  return first.startsWith("@") && second ? `${first}/${second}` : first;
}
