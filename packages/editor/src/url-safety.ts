export function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// An unescaped `]` closes the alt text early, so `![report].png](src)` parses as
// a paragraph and the image is lost on the next load.
export function escapeMarkdownText(value: string) {
  return value.replace(/[\\[\]]/g, (character) => `\\${character}`);
}

export function escapeMarkdownTitle(value: string) {
  return value.replace(/[\\"]/g, (character) => `\\${character}`);
}

// A bare markdown destination ends at the first whitespace or angle bracket, so
// those have to move into the `<...>` form to survive a round-trip.
export function formatMarkdownUrl(value: string) {
  if (!/[\s<>]/.test(value)) return value;
  return `<${value.replace(/[<>]/g, encodeURIComponent)}>`;
}
