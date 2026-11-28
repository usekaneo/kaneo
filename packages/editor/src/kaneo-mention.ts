import { mergeAttributes, Node } from "@tiptap/core";

// Inline atom node for an @mention of a workspace member. Stores the member id
// (used by the backend to fire a notification) and a display label, and
// round-trips through Markdown as `<kaneo-mention id label></kaneo-mention>`,
// mirroring the KaneoIssueLink extension.
export const KaneoMention = Node.create({
  name: "kaneoMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) =>
          el.getAttribute("id") || el.getAttribute("data-id") || "",
        renderHTML: (attrs) => ({ "data-id": attrs.id }),
      },
      label: {
        default: "",
        parseHTML: (el) =>
          el.getAttribute("label") || el.getAttribute("data-label") || "",
        renderHTML: (attrs) => ({ "data-label": attrs.label }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: "kaneo-mention[id]" },
      { tag: "span[data-type='kaneo-mention']" },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "kaneo-mention",
        class: "kaneo-mention",
      }),
      `@${node.attrs.label || ""}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.label || ""}`;
  },

  renderMarkdown(node: { attrs?: { id?: string; label?: string } }) {
    const id = String(node.attrs?.id || "");
    const label = String(node.attrs?.label || "");
    if (!id) return `@${label}`;
    return `<kaneo-mention id="${id}" label="${label}"></kaneo-mention>`;
  },
});
