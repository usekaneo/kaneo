import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AgentMentionNodeView } from "./agent-mention-node-view";
import {
  serializeAgentMention,
  type AgentMention,
} from "./agent-mention-token";

// Inline chip for a mentioned task or project. Its text form is the prompt
// token, so `editor.getText()` yields the prompt the API receives.
export const AgentMentionNode = Node.create({
  name: "agentMention",
  // Ahead of the default keymap so Backspace reaches the chip first.
  priority: 200,
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      type: { default: "task" },
      id: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-agent-mention]",
        getAttrs: (element) => ({
          type: element.getAttribute("data-type"),
          id: element.getAttribute("data-id"),
          label: element.getAttribute("data-label"),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-agent-mention": "",
        "data-type": node.attrs.type,
        "data-id": node.attrs.id,
        "data-label": node.attrs.label,
      }),
      `@${node.attrs.label}`,
    ];
  },

  renderText({ node }) {
    return serializeAgentMention(node.attrs as AgentMention);
  },

  // Removes a chip right before the caret in one keystroke.
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const before = selection.$from.nodeBefore;
        if (!selection.empty || before?.type.name !== this.name) return false;
        return editor.commands.deleteRange({
          from: selection.from - before.nodeSize,
          to: selection.from,
        });
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(AgentMentionNodeView, { as: "span" });
  },
});
