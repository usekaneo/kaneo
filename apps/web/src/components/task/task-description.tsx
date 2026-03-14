import type { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import { Fragment, Slice } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Braces,
  Check,
  ChevronDown,
  Code,
  Copy,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Paperclip,
  Quote,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
} from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bundledLanguages, type Highlighter } from "shiki";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { useUpdateTaskDescription } from "@/hooks/mutations/task/use-update-task-description";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { cn } from "@/lib/cn";
import debounce from "@/lib/debounce";
import { parseTaskListMarkdownToNodes } from "@/lib/editor-task-list-paste";
import {
  extractIssueKeyFromUrl,
  extractTaskIdFromUrl,
  isYouTubeUrl,
  normalizeUrl,
} from "@/lib/editor-url-utils";
import { getSharedShikiHighlighter } from "@/lib/shiki-highlighter";
import { toast } from "@/lib/toast";
import { uploadTaskImage } from "@/lib/upload-task-image";
import { AttachmentCard } from "./extensions/attachment-card";
import { EmbedBlock } from "./extensions/embed-block";
import { KaneoIssueLink } from "./extensions/kaneo-issue-link";
import {
  SHIKI_CODEBLOCK_REFRESH_META,
  ShikiCodeBlock,
} from "./extensions/shiki-code-block";
import { TaskItemWithCheckbox } from "./extensions/task-item-with-checkbox";
import "tippy.js/dist/tippy.css";

type TaskDescriptionProps = {
  taskId: string;
};

type HoveredCodeBlock = {
  language: string;
  nodePos: number;
  top: number;
  left: number;
};

type SlashRange = { from: number; to: number };

type SlashCommand = {
  id: string;
  label: string;
  group: "text" | "lists" | "insert";
  shortcut?: string;
  search: string;
  run: (editor: Editor, range: SlashRange) => void;
};

type SlashMenuState = {
  from: number;
  to: number;
  query: string;
  top: number;
  left: number;
  selectedIndex: number;
};

function formatMarkdown(markdown: string) {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n{2,}$/g, "\n");
}

type EmbedComposerState = {
  mode: "choice" | "input";
  url: string;
  top: number;
  left: number;
  linkRange?: { from: number; to: number };
  range?: SlashRange;
};

const CODE_LANGUAGE_OPTIONS = [
  { value: "bash", label: "Bash" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "css", label: "CSS" },
  { value: "clojure", label: "Clojure" },
  { value: "cypher", label: "Cypher" },
  { value: "dart", label: "Dart" },
  { value: "diff", label: "Diff" },
  { value: "elixir", label: "Elixir" },
  { value: "excel", label: "Excel" },
  { value: "go", label: "Golang" },
  { value: "graphql", label: "GraphQL" },
  { value: "html", label: "HTML" },
  { value: "haskell", label: "Haskell" },
  { value: "json", label: "JSON" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "kotlin", label: "Kotlin" },
  { value: "makefile", label: "Makefile" },
  { value: "markdown", label: "Markdown" },
  { value: "ocaml", label: "OCaml" },
  { value: "php", label: "PHP" },
  { value: "perl", label: "Perl" },
  { value: "plaintext", label: "Plaintext" },
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "reasonml", label: "ReasonML" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "toml", label: "TOML" },
  { value: "terraform", label: "Terraform" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
];

const SHIKI_LANGUAGE_ALIASES: Record<string, string> = {
  excel: "csv",
  plaintext: "text",
  reasonml: "ocaml",
};

const SLASH_COMMANDS: SlashCommand[] = [
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

export default function TaskDescription({ taskId }: TaskDescriptionProps) {
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTaskDescription } = useUpdateTaskDescription();

  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const taskRef = useRef(task);
  const updateTaskRef = useRef(updateTaskDescription);
  const activeTaskIdRef = useRef<string | null>(null);
  const lastEditorRef = useRef<Editor | null>(null);
  const pendingImageInsertRef = useRef<{
    editor: Editor;
    range?: SlashRange;
  } | null>(null);
  const hasHydratedRef = useRef(false);
  const isSyncingExternalContentRef = useRef(false);
  const latestSyncedMarkdownRef = useRef("");
  const hoveredCodeBlockElementRef = useRef<HTMLElement | null>(null);
  const [hoveredCodeBlock, setHoveredCodeBlock] =
    useState<HoveredCodeBlock | null>(null);
  const [isCodeLanguageMenuOpen, setIsCodeLanguageMenuOpen] = useState(false);
  const codeCopyResetTimeoutRef = useRef<number | null>(null);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [shikiHighlighter, setShikiHighlighter] = useState<Highlighter | null>(
    null,
  );
  const shikiHighlighterRef = useRef<Highlighter | null>(null);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [embedComposer, setEmbedComposer] = useState<EmbedComposerState | null>(
    null,
  );
  const [embedComposerError, setEmbedComposerError] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const slashMenuRef = useRef<SlashMenuState | null>(null);

  useEffect(() => {
    taskRef.current = task;
    updateTaskRef.current = updateTaskDescription;
  }, [task, updateTaskDescription]);

  const shikiSupportedLanguages = useMemo(
    () => new Set([...Object.keys(bundledLanguages), "text"]),
    [],
  );
  const toShikiLanguage = useCallback(
    (language: string) => SHIKI_LANGUAGE_ALIASES[language] || language,
    [],
  );
  const codeLanguages = useMemo(
    () =>
      CODE_LANGUAGE_OPTIONS.filter(({ value }) =>
        shikiSupportedLanguages.has(toShikiLanguage(value)),
      ),
    [shikiSupportedLanguages, toShikiLanguage],
  );
  const getOverlayPosition = useCallback(
    (editorView: Editor["view"], pos: number) => {
      const coords = editorView.coordsAtPos(pos);
      const shellRect = editorShellRef.current?.getBoundingClientRect();

      if (!shellRect) {
        return { top: coords.bottom + 8, left: coords.left };
      }

      return {
        top: coords.bottom - shellRect.top + 8,
        left: coords.left - shellRect.left,
      };
    },
    [],
  );

  const insertUploadedAsset = useCallback(
    (
      activeEditor: Editor,
      asset: Awaited<ReturnType<typeof uploadTaskImage>>,
      range?: SlashRange,
    ) => {
      const chain = activeEditor.chain().focus();

      if (range) {
        chain.deleteRange(range);
      } else {
        const { selection } = activeEditor.state;
        if (!selection.empty) {
          chain.setTextSelection(selection.to);
        }
      }

      if (asset.kind === "image") {
        chain
          .setImage({
            src: asset.url,
            alt: asset.alt,
          })
          .run();
        return;
      }

      chain
        .insertContent({
          type: "attachmentCard",
          attrs: {
            url: asset.url,
            filename: asset.filename,
            mimeType: asset.mimeType,
            size: asset.size,
          },
        })
        .run();
    },
    [],
  );

  const handleAssetFileUpload = useCallback(
    async (file: File, targetEditor?: Editor | null, range?: SlashRange) => {
      const activeEditor = targetEditor || lastEditorRef.current;

      if (!activeEditor) {
        toast.error("File upload failed");
        return;
      }

      const loadingToast = toast.loading("Uploading file...");

      try {
        const uploadedAsset = await uploadTaskImage({
          taskId,
          surface: "description",
          file,
        });
        insertUploadedAsset(activeEditor, uploadedAsset, range);

        toast.dismiss(loadingToast);
        toast.success(
          uploadedAsset.kind === "image" ? "Image uploaded" : "File attached",
        );
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error(
          error instanceof Error ? error.message : "Failed to upload file",
        );
      }
    },
    [insertUploadedAsset, taskId],
  );

  const openImagePicker = useCallback(
    (activeEditor?: Editor | null, range?: SlashRange) => {
      pendingImageInsertRef.current = activeEditor
        ? { editor: activeEditor, range }
        : null;
      imageInputRef.current?.click();
    },
    [],
  );

  const hasFileDrag = useCallback((event: React.DragEvent<HTMLElement>) => {
    return Array.from(event.dataTransfer?.items || []).some(
      (item) => item.kind === "file",
    );
  }, []);

  const handleShellDragEnter = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!taskId || !hasFileDrag(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDragActive(true);
    },
    [hasFileDrag, taskId],
  );

  const handleShellDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!taskId || !hasFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDragActive) {
        setIsDragActive(true);
      }
    },
    [hasFileDrag, isDragActive, taskId],
  );

  const handleShellDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!taskId || !hasFileDrag(event)) return;
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragActive(false);
      }
    },
    [hasFileDrag, taskId],
  );

  const handleShellDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!taskId || !hasFileDrag(event)) return;
      dragDepthRef.current = 0;
      setIsDragActive(false);
    },
    [hasFileDrag, taskId],
  );

  const slashCommands = useMemo(
    () => [
      ...SLASH_COMMANDS,
      {
        id: "file",
        label: "File",
        group: "insert" as const,
        search: "file attachment image photo picture upload",
        run: (activeEditor: Editor, range: SlashRange) => {
          activeEditor.chain().focus().deleteRange(range).run();
          openImagePicker(activeEditor);
        },
      },
    ],
    [openImagePicker],
  );

  useEffect(() => {
    let isDisposed = false;

    void getSharedShikiHighlighter()
      .then((nextHighlighter) => {
        shikiHighlighterRef.current = nextHighlighter;
        if (!isDisposed) {
          setShikiHighlighter(nextHighlighter);
        }
      })
      .catch((error) => {
        console.error("Failed to initialize Shiki highlighter:", error);
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  const debouncedUpdate = useCallback(
    debounce(async (markdown: string) => {
      const currentTask = taskRef.current;
      const updateTaskFn = updateTaskRef.current;
      if (!currentTask || !updateTaskFn) return;

      try {
        await updateTaskFn({
          ...currentTask,
          description: markdown,
        });
      } catch (error) {
        console.error("Failed to update description:", error);
      }
    }, 700),
    [],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          codeBlock: {
            HTMLAttributes: { class: "kaneo-tiptap-codeblock" },
          },
          trailingNode: false,
          heading: { levels: [1, 2, 3] },
        }),
        Link.configure({
          autolink: true,
          defaultProtocol: "https",
          linkOnPaste: true,
          openOnClick: false,
        }),
        Markdown.configure({
          markedOptions: {
            breaks: true,
            gfm: true,
          },
        }),
        ShikiCodeBlock.configure({
          highlighter: () => shikiHighlighterRef.current,
          resolveLanguage: toShikiLanguage,
          themeDark: "github-dark",
          themeLight: "github-light",
        }),
        EmbedBlock,
        AttachmentCard,
        KaneoIssueLink,
        TaskList,
        Image.configure({
          HTMLAttributes: {
            class: "kaneo-editor-image",
            loading: "lazy",
          },
        }),
        TaskItemWithCheckbox.configure({
          nested: true,
        }),
        Placeholder.configure({
          placeholder: "Write a description…",
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      editorProps: {
        attributes: {
          class: "kaneo-tiptap-prose",
        },
        handlePaste: (view, event) => {
          const pastedFiles = Array.from(event.clipboardData?.files || []);
          const pastedFile = pastedFiles[0];

          if (pastedFile) {
            event.preventDefault();
            void handleAssetFileUpload(pastedFile, editor);
            return true;
          }

          const plainText = event.clipboardData?.getData("text/plain") || "";
          const taskListNodes = parseTaskListMarkdownToNodes(plainText);
          if (taskListNodes) {
            event.preventDefault();
            const nodes = taskListNodes.map((node) =>
              view.state.schema.nodeFromJSON(node),
            );
            const fragment = Fragment.fromArray(nodes);
            view.dispatch(
              view.state.tr
                .replaceSelection(new Slice(fragment, 0, 0))
                .scrollIntoView(),
            );
            return true;
          }

          const pastedText = plainText.trim();
          if (!pastedText || /\s/.test(pastedText)) return false;

          const url = normalizeUrl(pastedText);
          if (!url) return false;

          const issueKey = extractIssueKeyFromUrl(url);
          const taskIdFromUrl = extractTaskIdFromUrl(url);
          if (issueKey || taskIdFromUrl) {
            event.preventDefault();
            view.dispatch(
              view.state.tr.replaceSelectionWith(
                view.state.schema.nodes.kaneoIssueLink.create({
                  url,
                  issueKey: issueKey || "",
                  taskId: taskIdFromUrl || "",
                }),
              ),
            );
            return true;
          }

          if (!isYouTubeUrl(url)) return false;

          event.preventDefault();
          const { from } = view.state.selection;
          const linkMark = view.state.schema.marks.link?.create({ href: url });
          const linkText = view.state.schema.text(
            url,
            linkMark ? [linkMark] : [],
          );
          view.dispatch(
            view.state.tr
              .replaceSelectionWith(linkText, false)
              .scrollIntoView(),
          );
          const coords = getOverlayPosition(view, view.state.selection.from);

          setEmbedComposer({
            mode: "choice",
            url,
            top: coords.top,
            left: coords.left,
            linkRange: { from, to: from + url.length },
          });
          setEmbedComposerError("");
          return true;
        },
        handleDrop: (view, event) => {
          const droppedFiles = Array.from(event.dataTransfer?.files || []);
          const droppedFile = droppedFiles[0];

          if (!droppedFile) return false;

          event.preventDefault();
          const coordinates = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          const dropRange = coordinates
            ? { from: coordinates.pos, to: coordinates.pos }
            : undefined;

          void handleAssetFileUpload(droppedFile, editor, dropRange);
          return true;
        },
        handleTextInput: (view, _from, _to, text) => {
          if (text !== "`") return false;

          const { state } = view;
          const { $from } = state.selection;
          if ($from.parent.type.name !== "paragraph") return false;

          const textBefore = $from.parent.textBetween(
            0,
            $from.parentOffset,
            "\0",
            "\0",
          );

          if (!/^\s*``$/.test(textBefore)) return false;

          const paragraphStart = $from.before();
          const codeBlock = state.schema.nodes.codeBlock?.create();
          if (!codeBlock) return false;

          const tr = state.tr.replaceWith(
            paragraphStart,
            paragraphStart + $from.parent.nodeSize,
            codeBlock,
          );

          tr.setSelection(
            TextSelection.near(tr.doc.resolve(paragraphStart + 1)),
          );
          view.dispatch(tr.scrollIntoView());
          return true;
        },
        handleKeyDown: (view, event) => {
          if (
            !(
              (event.metaKey || event.ctrlKey) &&
              event.key.toLowerCase() === "a"
            )
          ) {
            return false;
          }

          const { state } = view;
          const { $from } = state.selection;
          if ($from.parent.type.name !== "codeBlock") {
            return false;
          }

          event.preventDefault();
          view.dispatch(
            state.tr.setSelection(
              TextSelection.create(state.doc, $from.start(), $from.end()),
            ),
          );
          return true;
        },
      },
      onUpdate: ({ editor: activeEditor }) => {
        if (isSyncingExternalContentRef.current) return;
        const markdown = formatMarkdown(activeEditor.getMarkdown());
        if (markdown === latestSyncedMarkdownRef.current) return;
        latestSyncedMarkdownRef.current = markdown;
        debouncedUpdate(markdown);
      },
    },
    [getOverlayPosition, handleAssetFileUpload, toShikiLanguage],
  );

  useEffect(() => {
    if (!editor || !shikiHighlighter) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(SHIKI_CODEBLOCK_REFRESH_META, true),
    );
  }, [editor, shikiHighlighter]);

  useEffect(() => {
    if (!editor || typeof document === "undefined") return;

    const root = document.documentElement;
    const refreshShikiTheme = () => {
      editor.view.dispatch(
        editor.state.tr.setMeta(SHIKI_CODEBLOCK_REFRESH_META, true),
      );
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          refreshShikiTheme();
          break;
        }
      }
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleImagePreviewClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!(target instanceof HTMLImageElement)) return;
      if (!target.classList.contains("kaneo-editor-image")) return;

      event.preventDefault();
      setPreviewImage({
        src: target.currentSrc || target.src,
        alt: target.alt || "Preview image",
      });
    };

    const dom = editor.view.dom;
    dom.addEventListener("click", handleImagePreviewClick);

    return () => {
      dom.removeEventListener("click", handleImagePreviewClick);
    };
  }, [editor]);

  useEffect(() => {
    slashMenuRef.current = slashMenu;
  }, [slashMenu]);

  const setLink = useCallback(
    (prefilledUrl?: string) => {
      if (!editor) return;
      const previousUrl = editor.getAttributes("link").href as
        | string
        | undefined;
      const url = window.prompt("Enter URL", prefilledUrl || previousUrl || "");
      if (url === null) return;
      if (url.trim() === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    },
    [editor],
  );

  const filteredSlashCommands = useMemo(() => {
    const query = slashMenu?.query.trim().toLowerCase() || "";
    if (!query) return slashCommands;
    return slashCommands.filter(
      (command) =>
        command.label.toLowerCase().includes(query) ||
        command.search.includes(query),
    );
  }, [slashCommands, slashMenu?.query]);

  const filteredSlashCommandsRef = useRef<SlashCommand[]>(
    filteredSlashCommands,
  );
  useEffect(() => {
    filteredSlashCommandsRef.current = filteredSlashCommands;
  }, [filteredSlashCommands]);

  const groupedSlashCommands = useMemo(
    () => [
      {
        title: "Text",
        items: filteredSlashCommands.filter(
          (command) => command.group === "text",
        ),
      },
      {
        title: "Lists",
        items: filteredSlashCommands.filter(
          (command) => command.group === "lists",
        ),
      },
      {
        title: "Insert",
        items: filteredSlashCommands.filter(
          (command) => command.group === "insert",
        ),
      },
    ],
    [filteredSlashCommands],
  );

  const runSlashCommand = useCallback(
    (command: SlashCommand) => {
      if (!editor || !slashMenuRef.current) return;
      command.run(editor, {
        from: slashMenuRef.current.from,
        to: slashMenuRef.current.to,
      });
      setSlashMenu(null);
    },
    [editor],
  );

  const syncSlashMenu = useCallback(
    (activeEditor: Editor) => {
      const { state, view } = activeEditor;
      if (!state.selection.empty) {
        setSlashMenu(null);
        return;
      }

      const { $from } = state.selection;
      if ($from.parent.type.name === "codeBlock") {
        setSlashMenu(null);
        return;
      }

      const textBeforeCursor = state.doc.textBetween(
        $from.start(),
        $from.pos,
        "\n",
        "\0",
      );
      const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBeforeCursor);
      if (!match) {
        setSlashMenu(null);
        return;
      }

      const query = match[1] || "";
      const from = $from.pos - query.length - 1;
      const to = $from.pos;
      const coords = getOverlayPosition(view, $from.pos);

      setSlashMenu((current) => {
        const isSameQuery =
          current?.from === from &&
          current?.to === to &&
          current?.query === query;
        return {
          from,
          to,
          query,
          top: coords.top - 2,
          left: coords.left,
          selectedIndex: isSameQuery ? current.selectedIndex : 0,
        };
      });
    },
    [getOverlayPosition],
  );

  useEffect(() => {
    if (!editor) return;
    if (lastEditorRef.current !== editor) {
      hasHydratedRef.current = false;
      lastEditorRef.current = editor;
    }

    const isTaskChanged = activeTaskIdRef.current !== taskId;
    if (isTaskChanged) {
      activeTaskIdRef.current = taskId;
      hasHydratedRef.current = false;
      latestSyncedMarkdownRef.current = "";
    }

    const incomingMarkdown = formatMarkdown(task?.description || "");
    if (!hasHydratedRef.current) {
      isSyncingExternalContentRef.current = true;
      latestSyncedMarkdownRef.current = incomingMarkdown;
      editor.commands.setContent(incomingMarkdown, {
        emitUpdate: false,
        contentType: "markdown",
      });
      hasHydratedRef.current = true;
      requestAnimationFrame(() => {
        isSyncingExternalContentRef.current = false;
      });
      return;
    }

    if (editor.isFocused) return;
    if (incomingMarkdown === latestSyncedMarkdownRef.current) return;

    isSyncingExternalContentRef.current = true;
    latestSyncedMarkdownRef.current = incomingMarkdown;
    editor.commands.setContent(incomingMarkdown, {
      emitUpdate: false,
      contentType: "markdown",
    });
    requestAnimationFrame(() => {
      isSyncingExternalContentRef.current = false;
    });
  }, [editor, taskId, task?.description]);

  useEffect(() => {
    if (!editor) return;

    syncSlashMenu(editor);
    const onSelection = () => syncSlashMenu(editor);
    const onUpdate = () => syncSlashMenu(editor);

    editor.on("selectionUpdate", onSelection);
    editor.on("update", onUpdate);

    return () => {
      editor.off("selectionUpdate", onSelection);
      editor.off("update", onUpdate);
    };
  }, [editor, syncSlashMenu]);

  const submitEmbedComposer = useCallback(
    (mode: "embed" | "link") => {
      if (!editor || !embedComposer) return;
      const url = normalizeUrl(embedComposer.url);
      if (!url) {
        setEmbedComposerError("Enter a valid URL");
        return;
      }

      const chain = editor.chain().focus();
      if (embedComposer.mode === "choice" && mode === "link") {
        setEmbedComposer(null);
        setEmbedComposerError("");
        return;
      }

      if (embedComposer.linkRange) {
        chain.deleteRange(embedComposer.linkRange);
      } else if (embedComposer.range) {
        chain.deleteRange(embedComposer.range);
      }

      if (mode === "link") {
        chain
          .insertContent({
            type: "text",
            text: url,
            marks: [
              {
                type: "link",
                attrs: {
                  href: url,
                },
              },
            ],
          })
          .run();
      } else {
        if (!isYouTubeUrl(url)) {
          setEmbedComposerError("Only YouTube links can be embedded.");
          return;
        }
        chain
          .insertContent({
            type: "embedBlock",
            attrs: {
              url,
              mode: "embed",
            },
          })
          .run();
      }

      setEmbedComposer(null);
      setEmbedComposerError("");
    },
    [editor, embedComposer],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (embedComposer) {
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (embedComposer.mode === "choice") {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            return;
          }
        }

        if (event.key === "Tab") {
          event.preventDefault();
          submitEmbedComposer("embed");
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          submitEmbedComposer(
            embedComposer.mode === "choice" ? "embed" : "link",
          );
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setEmbedComposer(null);
          setEmbedComposerError("");
        }
        return;
      }

      const current = slashMenuRef.current;
      if (!editor || !current || !editor.isFocused) return;

      const commands = filteredSlashCommandsRef.current;
      if (event.key === "Escape") {
        event.preventDefault();
        setSlashMenu(null);
        return;
      }

      if (!commands.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashMenu((value) =>
          value
            ? {
                ...value,
                selectedIndex: (value.selectedIndex + 1) % commands.length,
              }
            : value,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashMenu((value) =>
          value
            ? {
                ...value,
                selectedIndex:
                  (value.selectedIndex - 1 + commands.length) % commands.length,
              }
            : value,
        );
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const command = commands[current.selectedIndex] || commands[0];
        if (!command) return;
        runSlashCommand(command);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [editor, embedComposer, runSlashCommand, submitEmbedComposer]);

  useEffect(() => {
    if (!slashMenu) return;
    if (filteredSlashCommands.length === 0) return;
    if (slashMenu.selectedIndex < filteredSlashCommands.length) return;
    setSlashMenu((value) => (value ? { ...value, selectedIndex: 0 } : value));
  }, [filteredSlashCommands, slashMenu]);

  const setCodeLanguage = (language: string | null) => {
    if (!editor || !hoveredCodeBlock) return;
    const { nodePos } = hoveredCodeBlock;
    const resolvedLanguage = language || "auto";

    if (resolvedLanguage === "auto") {
      editor
        .chain()
        .focus()
        .setNodeSelection(nodePos)
        .updateAttributes("codeBlock", { language: "" })
        .run();
      setHoveredCodeBlock((current) =>
        current ? { ...current, language: "auto" } : current,
      );
      return;
    }

    editor
      .chain()
      .focus()
      .setNodeSelection(nodePos)
      .updateAttributes("codeBlock", { language: resolvedLanguage })
      .run();
    setHoveredCodeBlock((current) =>
      current ? { ...current, language: resolvedLanguage } : current,
    );
  };

  const resolveCodeBlockNodeData = useCallback(
    (pos: number) => {
      if (!editor) return null;
      const resolvedPos = editor.state.doc.resolve(
        Math.max(0, Math.min(pos, editor.state.doc.content.size)),
      );

      for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
        const node = resolvedPos.node(depth);
        if (node.type.name !== "codeBlock") continue;
        return {
          language: (node.attrs.language as string | undefined) || "auto",
          nodePos: resolvedPos.before(depth),
        };
      }

      return null;
    },
    [editor],
  );

  const updateHoveredCodeBlockFromElement = useCallback(
    (codeBlockElement: HTMLElement | null) => {
      if (!editor || !codeBlockElement) {
        if (!isCodeLanguageMenuOpen) {
          hoveredCodeBlockElementRef.current = null;
          setHoveredCodeBlock(null);
        }
        return;
      }

      const domPos = editor.view.posAtDOM(codeBlockElement, 0);
      const nodeData = resolveCodeBlockNodeData(domPos);
      if (!nodeData) return;

      const rect = codeBlockElement.getBoundingClientRect();
      const shellRect = editorShellRef.current?.getBoundingClientRect();
      hoveredCodeBlockElementRef.current = codeBlockElement;
      setHoveredCodeBlock((current) => {
        if (current?.nodePos !== nodeData.nodePos) {
          setIsCodeCopied(false);
        }

        return {
          language: nodeData.language,
          nodePos: nodeData.nodePos,
          top: shellRect ? rect.top - shellRect.top + 8 : rect.top + 8,
          left: shellRect ? rect.right - shellRect.left - 10 : rect.right - 10,
        };
      });
    },
    [editor, isCodeLanguageMenuOpen, resolveCodeBlockNodeData],
  );

  const activeCodeLanguageLabel =
    codeLanguages.find(
      (language) => language.value === hoveredCodeBlock?.language,
    )?.label || "Auto detect";

  useEffect(() => {
    return () => {
      if (codeCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(codeCopyResetTimeoutRef.current);
      }
    };
  }, []);

  const copyHoveredCodeBlock = useCallback(async () => {
    if (!editor || !hoveredCodeBlock) return;
    const node = editor.state.doc.nodeAt(hoveredCodeBlock.nodePos);
    if (!node || node.type.name !== "codeBlock") return;

    const content = node.textContent || "";
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setIsCodeCopied(true);
      if (codeCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(codeCopyResetTimeoutRef.current);
      }
      codeCopyResetTimeoutRef.current = window.setTimeout(() => {
        setIsCodeCopied(false);
        codeCopyResetTimeoutRef.current = null;
      }, 1400);
    } catch (_error) {
      // ignore clipboard write failures
    }
  }, [editor, hoveredCodeBlock]);

  useEffect(() => {
    if (!hoveredCodeBlockElementRef.current || !hoveredCodeBlock) return;
    const syncPosition = () => {
      updateHoveredCodeBlockFromElement(hoveredCodeBlockElementRef.current);
    };

    window.addEventListener("scroll", syncPosition, true);
    window.addEventListener("resize", syncPosition);
    return () => {
      window.removeEventListener("scroll", syncPosition, true);
      window.removeEventListener("resize", syncPosition);
    };
  }, [hoveredCodeBlock, updateHoveredCodeBlockFromElement]);

  const handleEditorMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest(".kaneo-codeblock-language")) return;
      const hovered = target.closest(
        "pre.kaneo-tiptap-codeblock",
      ) as HTMLElement | null;

      if (!hovered) {
        if (!isCodeLanguageMenuOpen) {
          hoveredCodeBlockElementRef.current = null;
          setHoveredCodeBlock(null);
        }
        return;
      }

      updateHoveredCodeBlockFromElement(hovered);
    },
    [isCodeLanguageMenuOpen, updateHoveredCodeBlockFromElement],
  );

  const handleEditorMouseLeave = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      if (relatedTarget?.closest(".kaneo-codeblock-language")) return;
      if (isCodeLanguageMenuOpen) return;
      hoveredCodeBlockElementRef.current = null;
      setHoveredCodeBlock(null);
    },
    [isCodeLanguageMenuOpen],
  );

  return (
    <section
      ref={editorShellRef}
      aria-label="Task description editor"
      className={cn(
        "kaneo-tiptap-shell group",
        isDragActive && "is-drag-active",
      )}
      onDragEnter={handleShellDragEnter}
      onDragOver={handleShellDragOver}
      onDragLeave={handleShellDragLeave}
      onDrop={handleShellDrop}
    >
      <input
        ref={imageInputRef}
        type="file"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;

          const pendingInsert = pendingImageInsertRef.current;
          pendingImageInsertRef.current = null;
          void handleAssetFileUpload(
            file,
            pendingInsert?.editor,
            pendingInsert?.range,
          );

          event.target.value = "";
        }}
      />
      {editor && hoveredCodeBlock && (
        <div
          className="kaneo-codeblock-language"
          style={{
            top: hoveredCodeBlock.top,
            left: hoveredCodeBlock.left,
            position: "absolute",
          }}
        >
          <button
            type="button"
            className="kaneo-codeblock-language-trigger kaneo-codeblock-copy-trigger"
            aria-label={isCodeCopied ? "Copied" : "Copy code"}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              void copyHoveredCodeBlock();
            }}
          >
            {isCodeCopied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span>{isCodeCopied ? "Copied" : "Copy"}</span>
          </button>
          <DropdownMenu
            open={isCodeLanguageMenuOpen}
            onOpenChange={setIsCodeLanguageMenuOpen}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="kaneo-codeblock-language-trigger"
              >
                <span className="truncate">{activeCodeLanguageLabel}</span>
                <ChevronDown className="size-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={6}
              className="max-h-72 w-48 overflow-y-auto"
            >
              <DropdownMenuRadioGroup
                value={hoveredCodeBlock.language}
                onValueChange={setCodeLanguage}
              >
                <DropdownMenuRadioItem value="auto">
                  Auto detect
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {codeLanguages.map(({ value, label }) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {editor && (
        <BubbleMenu
          editor={editor}
          className="kaneo-tiptap-bubble"
          shouldShow={({ editor: activeEditor, from, to }) => {
            if (activeEditor.isActive("embedBlock")) return false;
            if (activeEditor.isActive("image")) return false;
            if (activeEditor.isEmpty) return false;
            return from !== to;
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("heading", { level: 2 }) &&
                "bg-accent text-accent-foreground",
            )}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("bulletList") &&
                "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("taskList") && "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListTodo className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("orderedList") &&
                "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("blockquote") &&
                "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("codeBlock") &&
                "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Braces className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="kaneo-tiptap-bubble-btn"
            onClick={() =>
              editor.chain().focus().insertTable({ cols: 3, rows: 3 }).run()
            }
          >
            <Table2 className="size-3.5" />
          </Button>
          <span className="kaneo-tiptap-bubble-separator" />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("bold") && "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("italic") && "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("underline") &&
                "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("strike") && "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("code") && "bg-accent text-accent-foreground",
            )}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "kaneo-tiptap-bubble-btn",
              editor.isActive("link") && "bg-accent text-accent-foreground",
            )}
            onClick={() => setLink()}
          >
            <Link2 className="size-3.5" />
          </Button>
        </BubbleMenu>
      )}

      {editor && slashMenu && (
        <div
          className="kaneo-tiptap-slash-menu"
          style={{
            top: slashMenu.top,
            left: slashMenu.left,
            position: "absolute",
          }}
        >
          {filteredSlashCommands.length > 0 ? (
            groupedSlashCommands.map((group) => {
              if (!group.items.length) return null;
              return (
                <div key={group.title} className="kaneo-tiptap-slash-group">
                  <div className="kaneo-tiptap-slash-group-title">
                    {group.title}
                  </div>
                  {group.items.map((command) => {
                    const index = filteredSlashCommands.findIndex(
                      (candidate) => candidate.id === command.id,
                    );
                    return (
                      <button
                        key={command.id}
                        type="button"
                        className={cn(
                          "kaneo-tiptap-slash-item",
                          slashMenu.selectedIndex === index && "is-selected",
                        )}
                        onMouseEnter={() =>
                          setSlashMenu((current) =>
                            current
                              ? { ...current, selectedIndex: index }
                              : current,
                          )
                        }
                        onMouseDown={(event) => {
                          event.preventDefault();
                          runSlashCommand(command);
                        }}
                      >
                        <span className="kaneo-tiptap-slash-label">
                          {command.label}
                        </span>
                        {command.shortcut && (
                          <span className="kaneo-tiptap-slash-shortcut">
                            {command.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          ) : (
            <div className="kaneo-tiptap-slash-empty">No commands</div>
          )}
        </div>
      )}

      {editor && embedComposer && (
        <div
          className="kaneo-embed-composer"
          style={{
            top: embedComposer.top,
            left: embedComposer.left,
            position: "absolute",
          }}
        >
          {embedComposer.mode === "choice" ? (
            <div className="kaneo-embed-choice-menu">
              <button
                type="button"
                className="kaneo-embed-choice-item is-primary"
                onMouseDown={(event) => {
                  event.preventDefault();
                  submitEmbedComposer("embed");
                }}
              >
                <span>Embed video</span>
                <span className="kaneo-embed-choice-hint">Tab</span>
              </button>
              <button
                type="button"
                className="kaneo-embed-choice-item"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setEmbedComposer(null);
                  setEmbedComposerError("");
                }}
              >
                <span>Keep as link</span>
                <span className="kaneo-embed-choice-hint">Esc</span>
              </button>
            </div>
          ) : (
            <form
              className="kaneo-embed-composer-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitEmbedComposer("embed");
              }}
            >
              <Input
                size="sm"
                value={embedComposer.url}
                onChange={(event) => {
                  setEmbedComposer((current) =>
                    current ? { ...current, url: event.target.value } : current,
                  );
                  if (embedComposerError) setEmbedComposerError("");
                }}
                placeholder="Paste URL"
                autoFocus
              />
              <div className="kaneo-embed-composer-actions">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => submitEmbedComposer("link")}
                >
                  As link
                </Button>
                <Button type="submit" size="xs">
                  Embed
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setEmbedComposer(null);
                    setEmbedComposerError("");
                  }}
                >
                  Cancel
                </Button>
              </div>
              {embedComposerError && (
                <p className="kaneo-embed-composer-error">
                  {embedComposerError}
                </p>
              )}
            </form>
          )}
        </div>
      )}

      <EditorContent
        editor={editor}
        className="kaneo-tiptap-content"
        onMouseMove={handleEditorMouseMove}
        onMouseLeave={handleEditorMouseLeave}
      />
      <button
        type="button"
        className="kaneo-editor-quick-attach"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => openImagePicker(editor)}
        aria-label="Attach file"
      >
        <Paperclip className="size-3.5" />
      </button>
      {isDragActive && (
        <div className="kaneo-editor-drop-indicator">
          <span>Drop image to upload</span>
        </div>
      )}
      <Dialog
        open={Boolean(previewImage)}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
      >
        <DialogPopup
          className="max-w-6xl border-0 bg-transparent p-0 shadow-none before:hidden"
          showCloseButton={false}
          bottomStickOnMobile={false}
        >
          {previewImage && (
            <div className="flex max-h-[90vh] items-center justify-center p-4">
              <img
                src={previewImage.src}
                alt={previewImage.alt}
                className="max-h-[85vh] max-w-[92vw] rounded-xl border border-white/12 bg-black/30 object-contain shadow-2xl"
              />
            </div>
          )}
        </DialogPopup>
      </Dialog>
    </section>
  );
}
