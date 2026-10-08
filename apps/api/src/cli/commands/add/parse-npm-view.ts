import type { PackageRelease } from "./select-version";

export type NpmViewResult =
  | { ok: true; releases: PackageRelease[] }
  | { ok: false; message: string };

type NpmErrorPayload = {
  error: { code?: unknown; summary?: unknown; detail?: unknown };
};

function isErrorPayload(value: unknown): value is NpmErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { error?: unknown }).error === "object" &&
    (value as { error?: unknown }).error !== null
  );
}

function toRelease(entry: unknown): PackageRelease[] {
  if (typeof entry === "string") return [{ version: entry }];
  if (typeof entry !== "object" || entry === null) return [];
  const { version, engines, deprecated } = entry as Record<string, unknown>;
  return typeof version === "string" ? [{ version, engines, deprecated }] : [];
}

function lastErrorLine(stderr: string): string | null {
  const lines = stderr
    .split("\n")
    .map((line) => line.replace(/^npm (?:error|ERR!)\s*/, "").trim())
    .filter(Boolean);
  return lines.at(-1) ?? null;
}

export function parseNpmView(
  stdout: string,
  stderr: string,
  exitCode: number,
): NpmViewResult {
  const text = stdout.trim();
  if (!text) {
    if (exitCode === 0) return { ok: true, releases: [] };
    return { ok: false, message: lastErrorLine(stderr) ?? "npm view failed." };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      message: lastErrorLine(stderr) ?? "npm view did not return JSON.",
    };
  }

  if (isErrorPayload(data)) {
    const { code, summary, detail } = data.error;
    if (
      code === "E404" &&
      typeof summary === "string" &&
      summary.startsWith("No match found")
    ) {
      return { ok: true, releases: [] };
    }
    const message = [summary, detail].find(
      (part): part is string => typeof part === "string" && part.length > 0,
    );
    return { ok: false, message: message ?? "npm view failed." };
  }

  const entries = Array.isArray(data) ? data : [data];
  return { ok: true, releases: entries.flatMap(toRelease) };
}
