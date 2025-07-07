import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className = "",
}: MarkdownRendererProps) {
  const editor = useEditor({
    editable: false,
    content,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
          HTMLAttributes: {
            class:
              "text-zinc-900 dark:text-zinc-100 font-semibold leading-tight",
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: "text-zinc-700 dark:text-zinc-300 leading-relaxed",
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class:
              "block rounded-md bg-zinc-100 dark:bg-zinc-800 p-4 font-mono text-sm text-zinc-900 dark:text-zinc-200 my-4",
          },
        },
        code: {
          HTMLAttributes: {
            class:
              "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 rounded px-1.5 py-0.5 font-mono text-sm",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class:
              "border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 italic text-zinc-600 dark:text-zinc-400",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal pl-6 space-y-1",
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-6 space-y-1",
          },
        },
        listItem: {
          HTMLAttributes: {
            class: "text-zinc-700 dark:text-zinc-300",
          },
        },
        horizontalRule: {
          HTMLAttributes: {
            class: "border-zinc-300 dark:border-zinc-600 my-6",
          },
        },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class:
            "text-indigo-600 dark:text-indigo-400 underline cursor-pointer hover:text-indigo-800 dark:hover:text-indigo-300",
        },
      }),
      Highlight.configure({
        HTMLAttributes: {
          class:
            "bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-300 rounded-sm px-1",
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "not-prose pl-2 space-y-1",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "flex gap-2 items-start",
        },
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        linkify: true,
        breaks: true,
      }),
    ],
  });

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert prose-zinc [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:mt-2 [&_h5]:mb-1 [&_h6]:text-xs [&_h6]:font-semibold [&_h6]:mt-2 [&_h6]:mb-1 ${className}`}
    >
      <EditorContent
        editor={editor}
        className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none [&_.ProseMirror]:p-0"
      />
    </div>
  );
}
