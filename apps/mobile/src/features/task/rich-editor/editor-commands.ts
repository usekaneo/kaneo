export type EditorCommand =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "strike" }
  | { type: "code" }
  | { type: "heading" }
  | { type: "bulletList" }
  | { type: "orderedList" }
  | { type: "taskList" }
  | { type: "blockquote" }
  | { type: "codeBlock" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "link"; href: string | null }
  | { type: "image"; src: string; alt: string };

export type EditorFormatState = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  heading: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  link: string | null;
  caretBottom: number;
};

export const emptyFormatState: EditorFormatState = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
  heading: false,
  bulletList: false,
  orderedList: false,
  taskList: false,
  blockquote: false,
  codeBlock: false,
  link: null,
  caretBottom: 0,
};
