import { mergeAttributes, Node } from "@tiptap/core";
import { i18n } from "@/lib/i18n";

type EmbedMode = "embed" | "link";

function isValidUrl(value: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getEmbedSource(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be"
    ) {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const videoId =
        host === "youtu.be"
          ? pathParts[0]
          : parsed.searchParams.get("v") ||
            (pathParts[0] === "shorts" ? pathParts[1] : null) ||
            (pathParts[0] === "live" ? pathParts[1] : null);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export const EmbedBlock = Node.create({
  name: "embedBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      url: {
        default: "",
      },
      mode: {
        default: "embed",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "kaneo-embed[url]",
      },
      {
        tag: "div[data-type='kaneo-embed'][data-url]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const url = String(HTMLAttributes.url || "");
    const mode = String(HTMLAttributes.mode || "embed") as EmbedMode;
    const embedSource = mode === "embed" ? getEmbedSource(url) : null;
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-type": "kaneo-embed",
      "data-url": url,
      "data-mode": mode,
      contenteditable: "false",
    });

    if (embedSource) {
      return [
        "div",
        attrs,
        [
          "iframe",
          {
            src: embedSource,
            loading: "lazy",
            allow:
              "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
            allowfullscreen: "true",
            referrerpolicy: "strict-origin-when-cross-origin",
            title: i18n.t("tasks:detail.editor.embed.embeddedContent"),
          },
        ],
      ];
    }

    if (mode === "embed") {
      return [
        "div",
        attrs,
        [
          "div",
          { class: "kaneo-embed-unsupported" },
          i18n.t("tasks:detail.editor.embed.onlyYoutubeInline"),
        ],
      ];
    }

    return [
      "div",
      attrs,
      [
        "a",
        {
          href: url,
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
        url,
      ],
    ];
  },

  renderMarkdown(
    node: { attrs?: { url?: string; mode?: string } },
    _helpers: unknown,
    _context: unknown,
  ) {
    const url = String(node.attrs?.url || "");
    const mode = node.attrs?.mode === "link" ? "link" : "embed";
    if (!isValidUrl(url)) return "";
    return `\n<kaneo-embed url="${escapeHtml(url)}" mode="${mode}" />\n`;
  },
});
