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
export const SOURCE_PROJECT_KEY_MAX = 16;

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
      ? words.map((word) => Array.from(word)[0]).join("")
      : (words[0] as string);

  const normalized = Array.from(key.toUpperCase())
    .slice(0, PROJECT_KEY_MAX)
    .join("");
  return normalized.length > 0 ? normalized : "PROJ";
}

export function sanitizeProjectKey(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const key = Array.from(raw.normalize("NFKC").toUpperCase())
    .filter((char) => /^[\p{L}\p{N}]$/u.test(char))
    .slice(0, SOURCE_PROJECT_KEY_MAX)
    .join("");
  return key.length > 0 ? key : null;
}

export function uniqueKey(
  candidate: string,
  taken: Set<string>,
  maxLength = PROJECT_KEY_MAX,
): string {
  if (!taken.has(candidate)) return candidate;

  const chars = Array.from(candidate);
  for (let suffix = 2; ; suffix++) {
    const tail = String(suffix);
    const head = chars
      .slice(0, Math.max(1, maxLength - tail.length - 1))
      .join("");
    const next = `${head}-${tail}`;
    if (!taken.has(next)) return next;
  }
}
