import { resolveUrl } from "./api/client";

/**
 * The web editor serializes rich nodes into Markdown as custom HTML tags. Markdown renderers
 * drop those, so they are rewritten into plain Markdown equivalents for display.
 */
const attrRegex = /([a-zA-Z-]+)="([^"]*)"/g;
const mentionRegex = /<kaneo-mention\b([^>]*)>([\s\S]*?)<\/kaneo-mention>/g;
const selfClosingRegex = /<(kaneo-[a-z-]+|img)\b([^>]*?)\/?>/g;
const spanRegex = /<span class="kaneo-embed-invalid-link">([\s\S]*?)<\/span>/g;

function unescape(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(attrRegex)) out[m[1]] = unescape(m[2]);
  return out;
}

export function toDisplayMarkdown(markdown: string, serverUrl: string): string {
  let text = markdown.replace(
    mentionRegex,
    (_, rawAttrs: string, inner: string) => {
      const label = attrs(rawAttrs).label || inner.replace(/^@/, "");
      return `**@${label}**`;
    },
  );
  text = text.replace(spanRegex, (_, inner: string) => inner);
  text = text.replace(selfClosingRegex, (_, tag: string, rawAttrs: string) => {
    const a = attrs(rawAttrs);
    switch (tag) {
      case "img":
        return `![${a.alt ?? ""}](${resolveUrl(serverUrl, a.src) ?? ""})`;
      case "kaneo-attachment":
        return `[${a.filename ?? "Attachment"}](${resolveUrl(serverUrl, a.url) ?? ""})`;
      case "kaneo-issue-link":
        return `[${a["issue-key"] || a.url}](${a.url})`;
      case "kaneo-embed":
        return `[${a.url}](${a.url})`;
      default:
        return "";
    }
  });
  text = text
    .replace(/^(\s*)[-*] \[ \]/gm, "$1- ☐")
    .replace(/^(\s*)[-*] \[[xX]\]/gm, "$1- ☑");
  text = text.replace(
    /(!?\[[^\]]*\]\()(\/api\/[^)\s]+)/g,
    (_, prefix: string, path: string) => prefix + serverUrl + path,
  );
  return text;
}

/** Plain-text preview for list rows. */
export function toPlainText(markdown?: string | null): string {
  if (!markdown) return "";
  return toDisplayMarkdown(markdown, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`#>~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mentionTag(userId: string, name: string): string {
  const escaped = name
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<kaneo-mention id="${userId}" label="${escaped}"></kaneo-mention>`;
}
