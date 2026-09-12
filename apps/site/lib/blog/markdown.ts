import { Marked, Renderer, type Tokens } from "marked";
import type { TocEntry } from "./types";

function stripTags(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-") || "section"
  );
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isExternal(href: string) {
  return /^https?:\/\//.test(href) && !href.startsWith("https://kaneo.app");
}

/**
 * Renders a post body and collects its heading outline in the same pass, so the
 * table of contents can never drift from the ids actually emitted in the HTML.
 */
export function renderMarkdown(markdown: string): {
  html: string;
  toc: TocEntry[];
} {
  const toc: TocEntry[] = [];
  const seen = new Map<string, number>();
  const instance = new Marked({ gfm: true, breaks: false });

  instance.use({
    renderer: {
      heading(token: Tokens.Heading) {
        const inline = this.parser.parseInline(token.tokens);
        const text = stripTags(inline);
        const base = slugify(text);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count + 1}`;

        if (token.depth === 2 || token.depth === 3) {
          toc.push({ id, text, depth: token.depth });
        }

        return `<h${token.depth} id="${id}">${inline}</h${token.depth}>\n`;
      },

      link(token: Tokens.Link) {
        const html = Renderer.prototype.link.call(this, token);
        if (!isExternal(token.href)) return html;
        return html.replace(
          "<a ",
          '<a target="_blank" rel="noreferrer noopener" ',
        );
      },

      // Wide tables must scroll inside the article rather than widening the page.
      table(token: Tokens.Table) {
        const html = Renderer.prototype.table.call(this, token);
        return `<div class="blog-prose-table">${html}</div>\n`;
      },

      image(token: Tokens.Image) {
        const title = token.title
          ? ` title="${escapeAttribute(token.title)}"`
          : "";
        return `<img src="${escapeAttribute(token.href)}" alt="${escapeAttribute(token.text)}"${title} loading="lazy" decoding="async" />`;
      },
    },
  });

  const html = instance.parse(markdown, { async: false });

  return { html, toc };
}

/** Words per minute used for the estimate shown on post pages. */
const READING_SPEED = 220;

export function readingTimeMinutes(markdown: string) {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ");

  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / READING_SPEED));
}
