import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import MentionList, {
  type MentionListRef,
  type MentionMember,
} from "./mention-list";

type MentionSuggestionOptions = {
  getMembers: () => MentionMember[];
};

// Adds an @-triggered autocomplete of workspace members to an editor. On select
// it inserts a `kaneoMention` node (which round-trips through Markdown). Built on
// @tiptap/suggestion so it stays self-contained and does not touch the editor's
// own keyboard/menu handling.
export const MentionSuggestion = Extension.create<MentionSuggestionOptions>({
  name: "kaneoMentionSuggestion",

  addOptions() {
    return { getMembers: () => [] };
  },

  addProseMirrorPlugins() {
    const getMembers = this.options.getMembers;

    const suggestion: Omit<SuggestionOptions, "editor"> = {
      char: "@",
      pluginKey: new PluginKey("kaneoMentionSuggestion"),
      allowSpaces: false,
      items: ({ query }) => {
        const q = query.toLowerCase();
        return getMembers()
          .filter((m) => m.label?.toLowerCase().includes(q))
          .slice(0, 8);
      },
      command: ({ editor, range, props }) => {
        const member = props as unknown as MentionMember;
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: "kaneoMention",
              attrs: { id: member.id, label: member.label },
            },
            { type: "text", text: " " },
          ])
          .run();
      },
      render: () => {
        let component: ReactRenderer<MentionListRef> | null = null;
        let popup: HTMLDivElement | null = null;

        const place = (clientRect?: (() => DOMRect | null) | null) => {
          if (!popup || !clientRect) return;
          const rect = clientRect();
          if (!rect) return;
          popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
          popup.style.left = `${rect.left + window.scrollX}px`;
        };

        return {
          onStart: (props) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });
            popup = document.createElement("div");
            popup.className = "kaneo-mention-popup";
            popup.appendChild(component.element);
            document.body.appendChild(popup);
            place(props.clientRect);
          },
          onUpdate: (props) => {
            component?.updateProps(props);
            place(props.clientRect);
          },
          onKeyDown: (props) => {
            if (props.event.key === "Escape") return false;
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            popup?.remove();
            popup = null;
            component?.destroy();
            component = null;
          },
        };
      },
    };

    return [Suggestion({ editor: this.editor, ...suggestion })];
  },
});
