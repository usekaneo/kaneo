import { readFileSync } from "node:fs";

/**
 * The release version from the root package.json. This file and the bundled
 * dist/index.js both sit one level below apps/api, so the same relative path
 * works in development and in the Docker image.
 */
function loadAppVersion(): string | null {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

let cached: { version: string | null } | undefined;

export function readAppVersion(): string | null {
  cached ??= { version: loadAppVersion() };
  return cached.version;
}
