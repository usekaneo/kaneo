import { existsSync } from "node:fs";
import { join } from "node:path";
import { EntryMissing } from "./errors/errors.js";

export type PluginEntries = {
  index: string;
  server: string | null;
  web: string | null;
};

function findFirst(root: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const path = join(root, candidate);
    if (existsSync(path)) return path;
  }
  return null;
}

export function findEntries(root: string): PluginEntries {
  const index = findFirst(root, ["src/index.ts"]);
  if (!index) throw new EntryMissing();
  return {
    index,
    server: findFirst(root, ["src/server.ts"]),
    web: findFirst(root, ["src/web.tsx", "src/web.ts"]),
  };
}
