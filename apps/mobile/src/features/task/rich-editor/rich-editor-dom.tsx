"use dom";

import { createBaseExtensions } from "@kaneo/editor";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useDOMImperativeHandle, type DOMImperativeFactory } from "expo/dom";
import { useEffect, useRef, type Ref } from "react";

import { isLegacyHtml } from "@/lib/legacy-html";

import type { EditorCommand, EditorFormatState } from "./editor-commands";
import { domNodeViews } from "./dom-node-views";
import { editorCss, type EditorTheme } from "./editor-theme";

export interface RichEditorHandle extends DOMImperativeFactory {
  run: (command: unknown) => void;
  focus: () => void;
  blur: () => void;
}

function formatState(editor: Editor): EditorFormatState {
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    code: editor.isActive("code"),
    heading: editor.isActive("heading"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    taskList: editor.isActive("taskList"),
    blockquote: editor.isActive("blockquote"),
    codeBlock: editor.isActive("codeBlock"),
    link: (editor.getAttributes("link").href as string | undefined) ?? null,
    caretBottom: caretBottom(editor),
  };
}

function caretBottom(editor: Editor): number {
  try {
    return (
      editor.view.coordsAtPos(editor.state.selection.head).bottom +
      window.scrollY
    );
  } catch {
    return 0;
  }
}

function runCommand(editor: Editor, command: EditorCommand) {
  const chain = editor.chain().focus();
  switch (command.type) {
    case "bold":
      return chain.toggleBold().run();
    case "italic":
      return chain.toggleItalic().run();
    case "strike":
      return chain.toggleStrike().run();
    case "code":
      return chain.toggleCode().run();
    case "heading":
      return chain.toggleHeading({ level: 2 }).run();
    case "bulletList":
      return chain.toggleBulletList().run();
    case "orderedList":
      return chain.toggleOrderedList().run();
    case "taskList":
      return chain.toggleTaskList().run();
    case "blockquote":
      return chain.toggleBlockquote().run();
    case "codeBlock":
      return chain.toggleCodeBlock().run();
    case "undo":
      return chain.undo().run();
    case "redo":
      return chain.redo().run();
    case "link": {
      if (!command.href) return chain.extendMarkRange("link").unsetLink().run();
      if (editor.state.selection.empty && !editor.isActive("link"))
        return chain
          .insertContent({
            type: "text",
            text: command.href,
            marks: [{ type: "link", attrs: { href: command.href } }],
          })
          .run();
      return chain
        .extendMarkRange("link")
        .setLink({ href: command.href })
        .run();
    }
    case "image":
      return chain.setImage({ src: command.src, alt: command.alt }).run();
  }
}

export default function RichEditorDom({
  ref,
  markdown,
  serverUrl,
  theme,
  placeholder,
  attachmentLabel,
  onChange,
  onFormatChange,
  onFocusChange,
}: {
  ref: Ref<RichEditorHandle>;
  markdown: string;
  serverUrl: string;
  theme: EditorTheme;
  placeholder: string;
  attachmentLabel: string;
  onChange: (markdown: string) => Promise<void>;
  onFormatChange: (state: EditorFormatState) => Promise<void>;
  onFocusChange: (focused: boolean) => Promise<void>;
  dom?: import("expo/dom").DOMProps;
}) {
  const emitted = useRef(markdown);
  const editor = useEditor({
    extensions: createBaseExtensions({
      placeholder,
      tableResizable: false,
      nodes: domNodeViews(serverUrl, attachmentLabel),
    }),
    content: markdown,
    contentType: isLegacyHtml(markdown) ? "html" : "markdown",
    onUpdate: ({ editor: e }) => {
      emitted.current = e.getMarkdown().replace(/\r\n/g, "\n");
      void onChange(emitted.current);
    },
    onTransaction: ({ editor: e }) => {
      if (e.isFocused) void onFormatChange(formatState(e));
    },
    onFocus: ({ editor: e }) => {
      void onFocusChange(true);
      void onFormatChange(formatState(e));
    },
    onBlur: () => {
      void onFocusChange(false);
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused || markdown === emitted.current) return;
    emitted.current = markdown;
    editor.commands.setContent(markdown, {
      emitUpdate: false,
      contentType: isLegacyHtml(markdown) ? "html" : "markdown",
    });
  }, [editor, markdown]);

  useDOMImperativeHandle(
    ref,
    () => ({
      run: (command: unknown) => {
        if (editor) runCommand(editor, command as EditorCommand);
      },
      focus: () => {
        editor?.commands.focus();
      },
      blur: () => {
        editor?.commands.blur();
      },
    }),
    [editor],
  );

  return (
    <>
      <style>{editorCss(theme)}</style>
      <EditorContent editor={editor} />
    </>
  );
}
