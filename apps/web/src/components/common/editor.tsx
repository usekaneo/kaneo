import { cn } from "@/lib/cn";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import {
  EditorContent,
  type Editor as TiptapEditor,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  CheckSquare,
  ChevronDown,
  Code,
  HighlighterIcon,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Type,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const TEXT_OPTIONS = [
  {
    label: "Normal text",
    value: "paragraph",
    icon: <Type className="w-4 h-4" />,
  },
  {
    label: "Heading 1",
    value: "h1",
    icon: <span className="text-sm">H1</span>,
  },
  {
    label: "Heading 2",
    value: "h2",
    icon: <span className="text-sm">H2</span>,
  },
];

export function Editor({
  value,
  onChange,
  placeholder = "Write something...",
}: EditorProps) {
  const [isTextMenuOpen, setIsTextMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    editorProps: {
      attributes: {
        class: "h-full flex-1",
      },
    },
    parseOptions: {
      preserveWhitespace: "full",
    },
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
          HTMLAttributes: {
            class: "text-zinc-900 dark:text-zinc-100",
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class:
              "block rounded-md bg-zinc-950 dark:bg-zinc-900 p-4 font-mono text-sm text-zinc-100 dark:text-zinc-200 my-4",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 border-zinc-300 dark:border-zinc-700 pl-4",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal pl-6",
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-6",
          },
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
          class: "not-prose pl-2",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "flex gap-2 items-start",
        },
      }),

      Placeholder.configure({
        placeholder,
      }),
    ],
    onSelectionUpdate: ({ editor }) => {
      editor.commands.focus();
    },
    content: value,
    onUpdate: ({ editor }: { editor: TiptapEditor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsTextMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getCurrentTextStyle = () => {
    if (!editor) return TEXT_OPTIONS[0];
    if (editor.isActive("heading", { level: 1 })) return TEXT_OPTIONS[1];
    if (editor.isActive("heading", { level: 2 })) return TEXT_OPTIONS[2];
    return TEXT_OPTIONS[0];
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none [&_.is-editor-empty]:text-zinc-500 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3">
      <div className="flex flex-wrap gap-1 mb-4 p-2 -mx-1 border-b border-zinc-200 dark:border-zinc-800">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsTextMenuOpen(!isTextMenuOpen)}
            className={cn(
              "flex items-center gap-2 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
              isTextMenuOpen && "bg-zinc-100 dark:bg-zinc-800",
            )}
          >
            {getCurrentTextStyle().icon}
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {getCurrentTextStyle().label}
            </span>
            <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          </button>

          {isTextMenuOpen && (
            <div className="absolute z-50 w-40 mt-1 py-1 rounded-md shadow-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              {TEXT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (option.value === "paragraph") {
                      editor.chain().focus().setParagraph().run();
                    } else if (option.value === "h1") {
                      editor.chain().focus().toggleHeading({ level: 1 }).run();
                    } else if (option.value === "h2") {
                      editor.chain().focus().toggleHeading({ level: 2 }).run();
                    }
                    setIsTextMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-sm",
                    "hover:bg-zinc-100 dark:hover:bg-zinc-700",
                    (option.value === "paragraph" &&
                      editor.isActive("paragraph")) ||
                      (option.value === "h1" &&
                        editor.isActive("heading", { level: 1 })) ||
                      (option.value === "h2" &&
                        editor.isActive("heading", { level: 2 }))
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "text-zinc-600 dark:text-zinc-300",
                  )}
                >
                  {option.icon}
                  <span className="flex-1 text-left">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-px h-6 mx-1 bg-zinc-200 dark:bg-zinc-800" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800",
            editor.isActive("bold") && "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <Bold className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800",
            editor.isActive("italic") && "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <Italic className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800",
            editor.isActive("strike") && "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <Strikethrough className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={cn(
            "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800",
            editor.isActive("highlight") && "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <HighlighterIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <div className="w-px h-6 mx-1 bg-zinc-200 dark:bg-zinc-800" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800",
            editor.isActive("bulletList") && "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <List className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800",
            editor.isActive("orderedList") && "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <ListOrdered className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={cn(
            "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800",
            editor.isActive("taskList") && "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <CheckSquare className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <div className="w-px h-6 mx-1 bg-zinc-200 dark:bg-zinc-800" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800",
            editor.isActive("blockquote") && "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <Quote className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={cn(
            "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800",
            editor.isActive("code") && "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <Code className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="flex-1 flex flex-col min-h-[200px] h-full [&_*]:focus:outline-none px-2"
      />
    </div>
  );
}
