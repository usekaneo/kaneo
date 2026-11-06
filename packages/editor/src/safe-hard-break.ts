import HardBreak from "@tiptap/extension-hard-break";

// SafeHardBreak replaces Tiptap StarterKit's HardBreak with a version that
// does not throw `TransformError: Invalid content for node paragraph` on
// Shift+Enter (KANEO-WEB-6). The upstream command routes through
// `chain().insertContent({ type: "hardBreak" })`, which calls
// `tr.replaceWith` under the hood and can reject the replace against complex
// schemas. A direct `tr.replaceSelectionWith(this.type.create())` is the
// reliable equivalent for a leaf inline node, and we gate the keymap on
// `editor.isEditable` so readOnly viewers never build a transaction in the
// first place.
export const SafeHardBreak = HardBreak.extend<Record<string, never>>({
  addCommands() {
    return {
      setHardBreak:
        () =>
        ({ commands, state, editor }) => {
          if (!editor.isEditable) return false;
          const { selection } = state;
          if (selection.$from.parent.type.spec.isolating) return false;
          return commands.command(({ tr }) => {
            tr.replaceSelectionWith(this.type.create());
            return true;
          });
        },
    };
  },

  addKeyboardShortcuts() {
    const insert = () => {
      if (!this.editor.isEditable) return false;
      const { selection } = this.editor.state;
      if (selection.$from.parent.type.spec.isolating) return false;
      return this.editor.commands.command(({ tr }) => {
        tr.replaceSelectionWith(this.type.create());
        return true;
      });
    };
    return {
      "Mod-Enter": insert,
      "Shift-Enter": insert,
    };
  },
});
