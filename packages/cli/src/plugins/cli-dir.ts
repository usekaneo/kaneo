import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function moduleDir(url: string): string | null {
  try {
    return dirname(fileURLToPath(url));
  } catch {
    return null;
  }
}

export const CLI_DIR = moduleDir(import.meta.url);
