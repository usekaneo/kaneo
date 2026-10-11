import type { BuildError } from "./errors.js";

const TAGS: ReadonlySet<string> = new Set<BuildError["_tag"]>([
  "PackageJsonMissing",
  "PackageJsonInvalid",
  "EntryMissing",
  "ViteMissing",
  "ViteUnloadable",
  "ViteTooOld",
  "TypesFailed",
  "InvalidOutput",
  "BuildFailed",
]);

export function isBuildError(value: unknown): value is BuildError {
  return (
    typeof value === "object" &&
    value !== null &&
    TAGS.has((value as { _tag?: unknown })._tag as string)
  );
}
