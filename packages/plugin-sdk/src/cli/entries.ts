import { existsSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "./errors.js";

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
  if (!index) {
    throw new CliError(
      "src/index.ts is missing. It must default-export definePlugin(import.meta.url, { ... }).",
    );
  }
  return {
    index,
    server: findFirst(root, ["src/server.ts"]),
    web: findFirst(root, ["src/web.tsx", "src/web.ts"]),
  };
}
