import { CHANGESET_LIMITS, type ChangesWithFiles } from "./changeset-schema";

export type ChangesetViolation =
  | "base_mismatch"
  | "protected_branch"
  | "invalid_path"
  | "git_directory"
  | "ci_file"
  | "symlink_escape"
  | "duplicate_path"
  | "invalid_content"
  | "too_many_files"
  | "too_large";

export type CheckedFile =
  | { path: string; action: "delete" }
  | {
      path: string;
      action: "upsert";
      mode: "100644" | "100755" | "120000";
      bytes: Buffer;
    };

export type ChangesetCheck =
  | { ok: true; files: CheckedFile[] }
  | { ok: false; violation: ChangesetViolation; path?: string };

// CI definitions run with repository secrets on the PR branch, so the agent
// may never change them; neither may it change local actions they call.
const CI_PREFIXES = [
  ".github/workflows/",
  ".github/actions/",
  ".gitea/workflows/",
  ".forgejo/workflows/",
];
const CI_FILES = [".gitlab-ci.yml"];

function isValidPath(path: string) {
  if (path.startsWith("/") || path.endsWith("/") || path.includes(":"))
    return false;
  // Control characters and backslashes have no portable meaning in a tree.
  // eslint-disable-next-line no-control-regex -- Reject control characters in repository paths.
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return false;
  return path
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isCiPath(path: string) {
  const lower = path.toLowerCase();
  return (
    CI_PREFIXES.some(
      (prefix) => lower === prefix.slice(0, -1) || lower.startsWith(prefix),
    ) ||
    [".github", ".gitea", ".forgejo"].includes(lower) ||
    CI_FILES.includes(lower)
  );
}

/**
 * Kaneo's policy for a job's changeset. Pure so it is enforced the same way
 * on upload and again right before the commit.
 */
export function checkChangeset(
  changeset: ChangesWithFiles,
  target: { baseSha: string; branch: string; protectedRefs: string[] },
): ChangesetCheck {
  if (changeset.baseSha !== target.baseSha)
    return { ok: false, violation: "base_mismatch" };
  if (target.protectedRefs.includes(target.branch))
    return { ok: false, violation: "protected_branch" };
  if (changeset.files.length > CHANGESET_LIMITS.files)
    return { ok: false, violation: "too_many_files" };
  const seen = new Set<string>();
  const files: CheckedFile[] = [];
  let total = 0;
  for (const file of changeset.files) {
    const { path } = file;
    if (!isValidPath(path)) return { ok: false, violation: "invalid_path" };
    if (path.split("/").some((segment) => segment.toLowerCase() === ".git"))
      return { ok: false, violation: "git_directory", path };
    if (isCiPath(path)) return { ok: false, violation: "ci_file", path };
    if (seen.has(path)) return { ok: false, violation: "duplicate_path", path };
    seen.add(path);
    if (file.action === "delete") {
      files.push({ path, action: "delete" });
      continue;
    }
    if (file.content.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(file.content))
      return { ok: false, violation: "invalid_content", path };
    const bytes = Buffer.from(file.content, "base64");
    if (bytes.toString("base64") !== file.content)
      return { ok: false, violation: "invalid_content", path };
    total += bytes.length;
    if (total > CHANGESET_LIMITS.bytes)
      return { ok: false, violation: "too_large" };
    if (file.mode === "120000")
      return { ok: false, violation: "symlink_escape", path };
    files.push({ path, action: "upsert", mode: file.mode, bytes });
  }
  return { ok: true, files };
}
