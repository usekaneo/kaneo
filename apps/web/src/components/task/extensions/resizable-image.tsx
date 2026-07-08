import Image from "@tiptap/extension-image";

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// The stock image extension already supports width/height attributes and
// drag-to-resize (via the `resize` option). The only missing piece is
// persistence: its markdown serializer emits `![alt](src)`, which drops the
// size. This extension keeps everything from the base extension and overrides
// only `renderMarkdown` so a resized image round-trips through markdown as an
// HTML `<img>` tag (raw HTML survives the markdown pipeline, the same technique
// EmbedBlock / KaneoIssueLink use). Unresized images keep the plain markdown
// syntax, so existing content is untouched.
export const ResizableImage = Image.extend({
  renderMarkdown(
    node: {
      attrs?: {
        src?: string;
        alt?: string;
        title?: string;
        width?: string | number | null;
        height?: string | number | null;
      };
    },
    _helpers: unknown,
    _context: unknown,
  ) {
    const attrs = node.attrs ?? {};
    const src = attrs.src ? String(attrs.src) : "";
    if (!src) return "";

    const alt = attrs.alt ? String(attrs.alt) : "";
    const title = attrs.title ? String(attrs.title) : "";
    const width =
      attrs.width != null && attrs.width !== "" ? String(attrs.width) : "";
    const height =
      attrs.height != null && attrs.height !== "" ? String(attrs.height) : "";

    // Fall back to a (fully escaped) HTML <img> when the image is resized, or
    // when a field contains characters that can't be represented safely in the
    // `![alt](src "title")` form — e.g. a filename-derived alt containing
    // brackets, or a src with spaces/parens. Otherwise keep the plain markdown
    // so existing content is untouched.
    const hasUnsafeMarkdown =
      /[[\]\\]/.test(alt) || /[\s()<>\\]/.test(src) || /["\\]/.test(title);

    if (width || height || hasUnsafeMarkdown) {
      const parts = [
        `src="${escapeHtmlAttribute(src)}"`,
        `alt="${escapeHtmlAttribute(alt)}"`,
        title ? `title="${escapeHtmlAttribute(title)}"` : "",
        width ? `width="${escapeHtmlAttribute(width)}"` : "",
        height ? `height="${escapeHtmlAttribute(height)}"` : "",
      ].filter(Boolean);
      return `\n<img ${parts.join(" ")} />\n`;
    }

    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },
});
