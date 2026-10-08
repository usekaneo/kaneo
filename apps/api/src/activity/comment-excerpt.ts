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
  const characters: string[] = [];
  for (const character of text) {
    characters.push(character);
    if (characters.length > EXCERPT_LENGTH) {
      return `${characters
        .slice(0, EXCERPT_LENGTH - 1)
        .join("")
        .trimEnd()}…`;
    }
  }
  return text;
}
