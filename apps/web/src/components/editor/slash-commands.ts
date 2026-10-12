import type { Editor } from "@tiptap/core";
import type { ShortcutId } from "@/lib/shortcuts/catalog";

export type SlashRange = { from: number; to: number };
export type SlashCommand = {
  id: string;
  label: string;
  group: "text" | "lists" | "insert";
  shortcutId?: ShortcutId;
  search: string;
  run: (editor: Editor, range: SlashRange) => void;
};

export const richTextCommands: SlashCommand[] = [
  {
    id: "paragraph",
    shortcutId: "editorParagraph",
    label: "Text",
    group: "text",
    search: "text paragraph normal",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: "heading-2",
    shortcutId: "editorHeading2",
    label: "Heading",
    group: "text",
    search: "heading title h2",
    run: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 2 })
        .run();
    },
  },
  {
    id: "bullet-list",
    shortcutId: "editorBulletList",
    label: "Bulleted list",
    group: "lists",
    search: "list bullet unordered",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "task-list",
    shortcutId: "editorChecklist",
    label: "To-do list",
    group: "lists",
    search: "todo to-do checklist checkbox task list",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "ordered-list",
    shortcutId: "editorNumberedList",
    label: "Numbered list",
    group: "lists",
    search: "list ordered numbered",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "blockquote",
    shortcutId: "editorQuote",
    label: "Quote",
    group: "insert",
    search: "quote blockquote",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: "code-block",
    shortcutId: "editorCodeBlock",
    label: "Code block",
    group: "insert",
    search: "code snippet",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: "table",
    label: "Table",
    group: "insert",
    search: "table grid",
    run: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ cols: 3, rows: 3 })
        .run();
    },
  },
];
