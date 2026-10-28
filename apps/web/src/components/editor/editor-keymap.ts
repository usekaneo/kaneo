import { type Editor, Extension } from "@tiptap/core";

function toggleTaskItem(editor: Editor) {
  if (!editor.isEditable) return false;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name !== "taskItem") continue;
    const position = $from.before(depth);
    return editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(position, undefined, {
        ...node.attrs,
        checked: !node.attrs.checked,
      });
      return true;
    });
  }
  return false;
}

export const EditorKeymap = Extension.create({
  name: "editorKeymap",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-x": () => this.editor.commands.toggleStrike(),
      "Mod-Shift-7": () => this.editor.commands.toggleTaskList(),
      "Mod-Shift-8": () => this.editor.commands.toggleBulletList(),
      "Mod-Shift-9": () => this.editor.commands.toggleOrderedList(),
      "Alt-Shift-.": () => this.editor.commands.toggleBlockquote(),
      "Mod-Shift-\\": () => this.editor.commands.toggleCodeBlock(),
      "Mod-Enter": () => toggleTaskItem(this.editor),
    };
  },
});
