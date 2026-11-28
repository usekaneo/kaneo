import { mergeAttributes, Node } from "@tiptap/core";
import { getEmbedSource } from "./embed-source";
import { escapeHtml, isValidUrl } from "./url-safety";

type EmbedMode = "embed" | "link";

export type EmbedBlockOptions = {
  embeddedContentTitle: () => string;
  onlyYoutubeInlineLabel: () => string;
};

export const EmbedBlock = Node.create<EmbedBlockOptions>({
  name: "embedBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      embeddedContentTitle: () => "Embedded content",
      onlyYoutubeInlineLabel: () =>
        "Only YouTube URLs can be embedded. Use link mode instead.",
    };
  },

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

    if (!isValidUrl(url)) {
      return [
        "div",
        attrs,
        ["span", { class: "kaneo-embed-invalid-link" }, url],
      ];
    }

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
            title: this.options.embeddedContentTitle(),
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
          this.options.onlyYoutubeInlineLabel(),
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
    if (!isValidUrl(url)) {
      return `\n<span class="kaneo-embed-invalid-link">${escapeHtml(url)}</span>\n`;
    }
    return `\n<kaneo-embed url="${escapeHtml(url)}" mode="${mode}" />\n`;
  },
});
