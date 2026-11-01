import { Extension } from "@tiptap/core";

// Enter sends; Shift+Enter keeps StarterKit's hard break. Lower priority than
// the mention suggestion so an open menu handles Enter first.
export const AgentSubmitKeymap = Extension.create<{ onSubmit: () => void }>({
  name: "agentSubmitKeymap",
  priority: 150,

  addOptions() {
    return { onSubmit: () => {} };
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (this.editor.view.composing) return false;
        this.options.onSubmit();
        return true;
      },
    };
  },
});
