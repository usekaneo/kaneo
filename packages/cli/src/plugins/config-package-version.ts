import { readFileSync } from "node:fs";
import { join } from "node:path";

export function configPackageVersion(projectDir: string): string | null {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(
        join(projectDir, "node_modules", "@kaneo", "config", "package.json"),
        "utf8",
      ),
    );
    const version = (parsed as { version?: unknown } | null)?.version;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}
