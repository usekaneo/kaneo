import { Extension, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";

export type AgentMentionQuery = { query: string; range: Range };

type AgentMentionSuggestionOptions = {
  onChange: (query: AgentMentionQuery | null) => void;
  onKeyDown: (event: KeyboardEvent) => boolean;
};

export const agentMentionPluginKey = new PluginKey("agentMentionSuggestion");

// Tracks an `@query` at the caret and hands it to React, which owns search and
// the menu. Runs before the composer's Enter-to-send keymap so an open menu
// gets Enter first.
export const AgentMentionSuggestion =
  Extension.create<AgentMentionSuggestionOptions>({
    name: "agentMentionSuggestion",
    priority: 200,

    addOptions() {
      return { onChange: () => {}, onKeyDown: () => false };
    },

    addProseMirrorPlugins() {
      const { onChange, onKeyDown } = this.options;
      return [
        Suggestion({
          editor: this.editor,
          pluginKey: agentMentionPluginKey,
          char: "@",
          render: () => ({
            onStart: ({ query, range }) => onChange({ query, range }),
            onUpdate: ({ query, range }) => onChange({ query, range }),
            onExit: () => onChange(null),
            onKeyDown: ({ event }) =>
              event.key !== "Escape" && onKeyDown(event),
          }),
        }),
      ];
    },
  });
