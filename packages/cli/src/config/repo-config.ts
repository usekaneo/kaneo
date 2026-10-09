import { existsSync, readFileSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export const REPO_CONFIG_FILE = ".kaneo.json";

export type RepoConfig = {
  readonly path: string;
  readonly workspace: string | undefined;
  readonly project: string | undefined;
};

export type RepoLink = {
  readonly workspace: string;
  readonly project: string;
};

export type RepoConfigObject = Readonly<Record<string, unknown>>;

export type ParsedRepoConfig =
  | { readonly kind: "missing" }
  | { readonly kind: "ok"; readonly value: RepoConfigObject }
  | { readonly kind: "invalid" };

function readText(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function stringField(value: unknown, key: string): string | undefined {
  const field = (value as Record<string, unknown> | null)?.[key];
  return typeof field === "string" && field.trim() !== ""
    ? field.trim()
    : undefined;
}

export function findRepoConfig(
  cwd: string,
  read: (path: string) => string | undefined = readText,
): RepoConfig | undefined {
  let directory = cwd;
  for (;;) {
    const path = join(directory, REPO_CONFIG_FILE);
    const text = read(path);
    if (text !== undefined) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return undefined;
      }
      return {
        path,
        workspace: stringField(parsed, "workspace"),
        project: stringField(parsed, "project"),
      };
    }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

export function findRepoRoot(
  cwd: string,
  exists: (path: string) => boolean = existsSync,
): string | undefined {
  let directory = cwd;
  for (;;) {
    if (exists(join(directory, ".git"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

export function linkFilePath(
  cwd: string,
  exists: (path: string) => boolean = existsSync,
): string {
  const root = findRepoRoot(cwd, exists);
  if (root === undefined) return join(cwd, REPO_CONFIG_FILE);
  let directory = cwd;
  while (directory !== root) {
    const candidate = join(directory, REPO_CONFIG_FILE);
    if (exists(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return join(root, REPO_CONFIG_FILE);
}

export function parseRepoConfigObject(
  text: string | undefined,
): ParsedRepoConfig {
  if (text === undefined) return { kind: "missing" };
  if (text.trim() === "") return { kind: "ok", value: {} };
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? { kind: "ok", value: parsed as RepoConfigObject }
      : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

export function mergeRepoLink(
  existing: RepoConfigObject | undefined,
  link: RepoLink,
): RepoConfigObject {
  return { ...existing, workspace: link.workspace, project: link.project };
}

export function hasRepoLink(value: RepoConfigObject): boolean {
  return "workspace" in value || "project" in value;
}

export function removeRepoLink(
  existing: RepoConfigObject,
): RepoConfigObject | undefined {
  const { workspace: _workspace, project: _project, ...rest } = existing;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

export function serializeRepoConfig(value: RepoConfigObject): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isMissing(cause: unknown): boolean {
  return (cause as { code?: unknown } | null)?.code === "ENOENT";
}

export const readRepoConfigObject = Effect.fnUntraced(function* (path: string) {
  const text = yield* Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: (cause) => cause,
  }).pipe(
    Effect.catch((cause) =>
      isMissing(cause)
        ? Effect.succeed(undefined)
        : Effect.fail(
            new InvalidArgument({
              message: `Could not read ${path}.`,
              hint: "Check that the file is readable.",
            }),
          ),
    ),
  );
  const parsed = parseRepoConfigObject(text);
  if (parsed.kind === "invalid") {
    return yield* new InvalidArgument({
      message: `${path} is not a JSON object, so it was left untouched.`,
      hint: "Fix or delete the file, then run this again.",
    });
  }
  return parsed.kind === "ok" ? parsed.value : undefined;
});

export const writeRepoConfig = (path: string, value: RepoConfigObject) =>
  Effect.tryPromise({
    try: () => writeFile(path, serializeRepoConfig(value), "utf8"),
    catch: () =>
      new InvalidArgument({
        message: `Could not write ${path}.`,
        hint: "Check that the directory is writable.",
      }),
  });

export const deleteRepoConfig = (path: string) =>
  Effect.tryPromise({
    try: () => rm(path, { force: true }),
    catch: () =>
      new InvalidArgument({
        message: `Could not delete ${path}.`,
        hint: "Check that the directory is writable.",
      }),
  });
