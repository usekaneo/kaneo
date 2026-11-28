import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export function resolveTsc(root: string): string | null {
  try {
    const manifestPath = createRequire(join(root, "package.json")).resolve(
      "typescript/package.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      bin?: string | Record<string, string>;
    };
    const bin =
      typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.tsc;
    return bin ? join(dirname(manifestPath), bin) : null;
  } catch {
    return null;
  }
}

export function runTsc(
  tsc: string,
  project: string,
  cwd: string,
): { ok: boolean; output: string } {
  const result = spawnSync(
    process.execPath,
    [tsc, "-p", project, "--pretty", "false"],
    { cwd, encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return {
    ok: result.status === 0,
    output: output || String(result.error ?? ""),
  };
}
