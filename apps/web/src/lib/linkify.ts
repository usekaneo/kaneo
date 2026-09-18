export type TextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

// http(s)://… or www.…, stopping before trailing punctuation that usually
// ends the sentence rather than the link ("see https://a.com.").
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"]*[^\s<>"'.,;:!?)\]}]/gi;

/** Only http and https ever become links; everything else stays text. */
export function safeHref(raw: string) {
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Splits plain text into text and link parts. Never produces HTML. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const value = match[0];
    const start = match.index ?? 0;
    const href = safeHref(value);
    if (!href) continue;
    if (start > last)
      parts.push({ type: "text", value: text.slice(last, start) });
    parts.push({ type: "link", value, href });
    last = start + value.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

/** Distinct links in a message, in order, for preview cards. */
export function linksIn(text: string, max = 3) {
  const seen = new Set<string>();
  for (const part of linkify(text)) {
    if (part.type === "link") seen.add(part.href);
    if (seen.size >= max) break;
  }
  return [...seen];
}
