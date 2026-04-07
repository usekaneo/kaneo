import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path to this package's `dist/index.js` (the MCP stdio entry).
 * Resolved from `dist/install/resolve-entry.js` at runtime.
 */
export function resolvePackageEntryPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../index.js");
}
