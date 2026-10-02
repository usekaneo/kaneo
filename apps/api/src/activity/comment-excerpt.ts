const EXCERPT_LENGTH = 240;

// Comments are stored as editor markup. Feeds outside the task show a short
// plain-text preview instead of shipping and rendering the whole body.
export function commentExcerpt(content: string | null): string | null {
  if (!content) return null;

  const text = content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;
  if (text.length <= EXCERPT_LENGTH) return text;
  return `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
}
