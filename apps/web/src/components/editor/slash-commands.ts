import type { Editor } from "@tiptap/core";

export type SlashRange = { from: number; to: number };
export type SlashCommand = {
  id: string;
  label: string;
  group: "text" | "lists" | "insert";
  shortcut?: string;
  search: string;
  run: (editor: Editor, range: SlashRange) => void;
};

export const richTextCommands: SlashCommand[] = [
  {
    id: "paragraph",
    label: "Text",
    group: "text",
    search: "text paragraph normal",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: "heading-2",
    label: "Heading",
    group: "text",
    shortcut: "Ctrl Alt 2",
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
    label: "Bulleted list",
    group: "lists",
    shortcut: "Ctrl Alt 8",
    search: "list bullet unordered",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "task-list",
    label: "To-do list",
    group: "lists",
    search: "todo to-do checklist checkbox task list",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "ordered-list",
    label: "Numbered list",
    group: "lists",
    shortcut: "Ctrl Alt 9",
    search: "list ordered numbered",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "blockquote",
    label: "Quote",
    group: "insert",
    search: "quote blockquote",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: "code-block",
    label: "Code block",
    group: "insert",
    shortcut: "Ctrl Alt \\",
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
