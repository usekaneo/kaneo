// Mirrors `toSlug` in apps/api/src/column/controllers/create-column.ts. Kaneo
// derives a column's slug from its name server-side, and tasks reference the
// column by that slug, so we have to predict it to place cards correctly.
export function toColumnSlug(name: string): string {
  const slug = name
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return /[\p{L}\p{N}]/u.test(slug) ? slug : "";
}

// Kaneo rejects these as column slugs: they are virtual task statuses.
export const RESERVED_COLUMN_SLUGS = ["planned", "archived"];

const PROJECT_KEY_MAX = 8;

export function toProjectKey(name: string): string {
  const words = name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

  if (words.length === 0) return "PROJ";

  const key =
    words.length > 1
      ? words.map((word) => word[0]).join("")
      : (words[0] as string);

  const normalized = key.toUpperCase().slice(0, PROJECT_KEY_MAX);
  return normalized.length > 0 ? normalized : "PROJ";
}

export function uniqueKey(
  candidate: string,
  taken: Set<string>,
  maxLength = PROJECT_KEY_MAX,
): string {
  if (!taken.has(candidate)) return candidate;

  for (let suffix = 2; ; suffix++) {
    const tail = String(suffix);
    const head = candidate.slice(0, Math.max(1, maxLength - tail.length - 1));
    const next = `${head}-${tail}`;
    if (!taken.has(next)) return next;
  }
}
