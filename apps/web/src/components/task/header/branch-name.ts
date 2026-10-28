const DEFAULT_PATTERN = "{slug}-{number}";

function slugify(text: string | undefined) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function generateBranchName(
  pattern: string | null | undefined,
  projectSlug: string | undefined,
  taskNumber: number | null | undefined,
  taskTitle: string | undefined,
) {
  if (!projectSlug || !taskNumber) return "";
  const base = pattern || DEFAULT_PATTERN;
  const resolved =
    base === DEFAULT_PATTERN ? `${DEFAULT_PATTERN}-{title}` : base;
  return resolved
    .replace("{slug}", projectSlug.toLowerCase())
    .replace("{number}", taskNumber.toString())
    .replace("{title}", slugify(taskTitle));
}
