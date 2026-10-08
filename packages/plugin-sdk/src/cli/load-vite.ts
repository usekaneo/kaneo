import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CliError, errorMessage } from "./errors.js";

export type ViteConfig = Record<string, unknown>;

export type ViteModule = {
  version: string;
  rolldownVersion?: string;
  build(config: ViteConfig): Promise<unknown>;
};

export type ViteFlavor = {
  rolldown: boolean;
  bundlerOptionsKey: "rollupOptions" | "rolldownOptions";
};

const MISSING_VITE =
  "kaneo-plugin build needs Vite 7 or newer. Add it to the plugin: npm install --save-dev vite";

function resolveFromRoot(root: string): string | null {
  try {
    return createRequire(join(root, "package.json")).resolve("vite");
  } catch {
    return null;
  }
}

export async function loadVite(root: string): Promise<ViteModule> {
  const resolved = resolveFromRoot(root);
  let vite: Partial<ViteModule>;
  try {
    vite = await import(resolved ? pathToFileURL(resolved).href : "vite");
  } catch (error) {
    throw new CliError(
      resolved ? `Could not load Vite: ${errorMessage(error)}` : MISSING_VITE,
    );
  }
  if (typeof vite.build !== "function" || typeof vite.version !== "string") {
    throw new CliError(MISSING_VITE);
  }
  return vite as ViteModule;
}

export function describeVite(vite: ViteModule): ViteFlavor {
  const major = Number.parseInt(vite.version, 10);
  if (major < 7) {
    throw new CliError(
      `kaneo-plugin build needs Vite 7 or newer, found ${vite.version}`,
    );
  }
  return {
    rolldown: typeof vite.rolldownVersion === "string",
    bundlerOptionsKey: major >= 8 ? "rolldownOptions" : "rollupOptions",
  };
}
