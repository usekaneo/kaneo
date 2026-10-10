import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { PluginLoadError } from "../load-error.js";

export const DEFAULT_PROJECT_DIR = "/kaneo";

export const CONFIG_FILE_NAMES = [
  "kaneo.config.ts",
  "kaneo.config.js",
  "kaneo.config.mjs",
] as const;

export function configCandidates(dir: string): string[] {
  return CONFIG_FILE_NAMES.map((name) => join(dir, name));
}

export const DEFAULT_CONFIG_PATH = join(
  DEFAULT_PROJECT_DIR,
  CONFIG_FILE_NAMES[0],
);

export const DEFAULT_CONFIG_PATHS = configCandidates(DEFAULT_PROJECT_DIR);

export function findConfigPath({
  configEnv = process.env.KANEO_CONFIG,
  cwd = process.cwd(),
  exists = existsSync,
  candidates = DEFAULT_CONFIG_PATHS,
}: {
  configEnv?: string;
  cwd?: string;
  exists?: (path: string) => boolean;
  candidates?: string[];
} = {}): string | null {
  const configured = configEnv?.trim();
  if (configured) {
    const path = resolve(cwd, configured);
    if (!exists(path)) {
      throw new PluginLoadError({
        plugin: null,
        stage: "config",
        message: `KANEO_CONFIG points to ${path}, which does not exist.`,
        hint: "Fix the path in KANEO_CONFIG, or unset it to use /kaneo/kaneo.config.ts.",
      });
    }
    return path;
  }
  return candidates.find((candidate) => exists(candidate)) ?? null;
}
