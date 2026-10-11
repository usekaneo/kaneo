import { PLUGIN_ID_PATTERN, derivePluginId } from "./plugin-id.js";

export type PluginPackage = {
  id: string;
  name: string;
  packageName: string;
  version: string;
  description: string | null;
  engines: string | null;
  server: string | null;
  web: string | null;
};

export type ParsePluginPackageResult =
  | { ok: true; plugin: PluginPackage }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readExport(target: unknown): string | null {
  if (typeof target === "string") return target;
  if (!isRecord(target)) return null;
  for (const condition of ["import", "default"]) {
    const value = readExport(target[condition]);
    if (value) return value;
  }
  return null;
}

function isInsidePackage(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return normalized.startsWith("./") && !normalized.split("/").includes("..");
}

export function parsePluginPackage(
  packageJson: unknown,
): ParsePluginPackageResult {
  if (!isRecord(packageJson)) {
    return { ok: false, error: "package.json is not an object" };
  }

  const packageName = packageJson.name;
  if (typeof packageName !== "string" || !packageName) {
    return { ok: false, error: 'package.json has no "name"' };
  }

  const exportsField = packageJson.exports;
  if (!isRecord(exportsField)) {
    return { ok: false, error: 'package.json has no "exports" map' };
  }

  const server = readExport(exportsField["./server"]);
  const web = readExport(exportsField["./web"]);
  if (!server && !web) {
    return {
      ok: false,
      error: 'Export at least one of "./server" or "./web"',
    };
  }
  for (const [key, entry] of [
    ["./server", server],
    ["./web", web],
  ] as const) {
    if (entry && !isInsidePackage(entry)) {
      return {
        ok: false,
        error: `Export "${key}" must point to a file inside the package`,
      };
    }
  }

  const kaneo = isRecord(packageJson.kaneo) ? packageJson.kaneo : {};
  const id =
    typeof kaneo.id === "string" ? kaneo.id : derivePluginId(packageName);
  if (!PLUGIN_ID_PATTERN.test(id)) {
    return {
      ok: false,
      error: `Plugin id "${id}" must match ${PLUGIN_ID_PATTERN.source}`,
    };
  }

  const engines = isRecord(packageJson.engines)
    ? packageJson.engines.kaneo
    : undefined;

  return {
    ok: true,
    plugin: {
      id,
      name:
        typeof kaneo.name === "string" && kaneo.name.trim()
          ? kaneo.name.trim()
          : packageName,
      packageName,
      version:
        typeof packageJson.version === "string" ? packageJson.version : "0.0.0",
      description:
        typeof packageJson.description === "string"
          ? packageJson.description
          : null,
      engines: typeof engines === "string" ? engines : null,
      server,
      web,
    },
  };
}
