/**
 * A one-line plain-text preview of a markdown comment. Mirrors the API's
 * commentExcerpt so a reply shows the same quote before and after saving.
 */
export function commentExcerpt(markdown: string | null, max = 140) {
  const text = (markdown ?? "")
    // Mentions are stored as <kaneo-mention …>Name</kaneo-mention>.
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
