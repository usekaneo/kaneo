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
  Check,
  ChevronDown,
  Copy,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Paperclip,
  UnderlineIcon,
} from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { bundledLanguages, type Highlighter } from "shiki";
import { AttachmentCard } from "@/components/task/extensions/attachment-card";
import { EmbedBlock } from "@/components/task/extensions/embed-block";
import { KaneoIssueLink } from "@/components/task/extensions/kaneo-issue-link";
import {
  SHIKI_CODEBLOCK_REFRESH_META,
  ShikiCodeBlock,
} from "@/components/task/extensions/shiki-code-block";
import { TaskItemWithCheckbox } from "@/components/task/extensions/task-item-with-checkbox";
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
import { cn } from "@/lib/cn";
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

type CommentEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  proseClassName?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  showBubbleMenu?: boolean;
  slashMenuPosition?: "absolute" | "fixed";
  onSubmitShortcut?: () => void;
  onCancelShortcut?: () => void;
  taskId?: string;
  uploadSurface?: "description" | "comment";
  ensureTaskId?: () => Promise<string | null>;
  showQuickAttachButton?: boolean;
  onAttachActionChange?: (attach: (() => void) | null) => void;
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

type HoveredCodeBlock = {
  language: string;
  nodePos: number;
  top: number;
  left: number;
};

const CODE_LANG_VALUES = [
  "bash",
  "csharp",
  "cpp",
  "css",
  "go",
  "graphql",
  "html",
  "json",
  "java",
  "javascript",
  "markdown",
  "plaintext",
  "python",
  "rust",
  "sql",
  "swift",
  "typescript",
  "yaml",
] as const;

type EmbedComposerErrorKey = "embedErrorInvalidUrl" | "embedErrorYoutubeOnly";

const COMMENT_SHIKI_LANGUAGE_ALIASES: Record<string, string> = {
  plaintext: "text",
};

function normalizeMarkdown(markdown: string) {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00A0/g, " ")
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

export default function CommentEditor({
  value,
  onChange,
  placeholder,
  className,
  contentClassName,
  proseClassName,
  autoFocus = false,
  disabled = false,
  readOnly = false,
  showBubbleMenu = true,
  slashMenuPosition = "absolute",
  onSubmitShortcut,
  onCancelShortcut,
  taskId,
  uploadSurface = "comment",
  ensureTaskId,
  showQuickAttachButton = true,
  onAttachActionChange,
}: CommentEditorProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder =
    placeholder ?? t("activity:comment.leavePlaceholder");
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const isSyncingRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const latestValueRef = useRef(normalizeMarkdown(value || ""));
  const lastEditorRef = useRef<Editor | null>(null);
  const taskIdRef = useRef(taskId);
  const ensureTaskIdRef = useRef(ensureTaskId);
  const uploadSurfaceRef = useRef(uploadSurface);
  const onSubmitShortcutRef = useRef(onSubmitShortcut);
  const onCancelShortcutRef = useRef(onCancelShortcut);
  onSubmitShortcutRef.current = onSubmitShortcut;
  onCancelShortcutRef.current = onCancelShortcut;
  const pendingImageInsertRef = useRef<{
    editor: Editor;
    range?: SlashRange;
  } | null>(null);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [shikiHighlighter, setShikiHighlighter] = useState<Highlighter | null>(
    null,
  );
  const shikiHighlighterRef = useRef<Highlighter | null>(null);
  const [hoveredCodeBlock, setHoveredCodeBlock] =
    useState<HoveredCodeBlock | null>(null);
  const hoveredCodeBlockElementRef = useRef<HTMLElement | null>(null);
  const codeLanguageHideTimeoutRef = useRef<number | null>(null);
  const codeCopyResetTimeoutRef = useRef<number | null>(null);
  const [isCodeLanguageMenuOpen, setIsCodeLanguageMenuOpen] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [embedComposer, setEmbedComposer] = useState<EmbedComposerState | null>(
    null,
  );
  const [embedComposerError, setEmbedComposerError] =
    useState<EmbedComposerErrorKey | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const codeLanguages = useMemo(
    () =>
      CODE_LANG_VALUES.map((value) => ({
        value,
        label: t(`activity:comment.editor.codeLang.${value}`),
      })),
    [t],
  );
  const availableShikiLanguages = useMemo(
    () => new Set(Object.keys(bundledLanguages)),
    [],
  );
  const toShikiLanguage = useCallback(
    (language: string) => {
      const normalized = language.toLowerCase();
      const alias = COMMENT_SHIKI_LANGUAGE_ALIASES[normalized];
      if (alias) return alias;
      if (availableShikiLanguages.has(normalized)) return normalized;
      return "text";
    },
    [availableShikiLanguages],
  );
  const getOverlayPosition = useCallback(
    (editorView: Editor["view"], pos: number) => {
      const coords = editorView.coordsAtPos(pos);
      const shellRect = editorShellRef.current?.getBoundingClientRect();

      if (slashMenuPosition === "fixed" || !shellRect) {
        return { top: coords.bottom + 8, left: coords.left };
      }

      return {
        top: coords.bottom - shellRect.top + 8,
        left: coords.left - shellRect.left,
      };
    },
    [slashMenuPosition],
  );

  useEffect(() => {
    taskIdRef.current = taskId;
    ensureTaskIdRef.current = ensureTaskId;
    uploadSurfaceRef.current = uploadSurface;
  }, [ensureTaskId, taskId, uploadSurface]);

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
      const resolvedTaskId =
        taskIdRef.current ?? (await ensureTaskIdRef.current?.());

      if (!activeEditor || !resolvedTaskId) {
        toast.error(t("activity:comment.editor.uploadsOnlyOnSavedTasks"));
        return;
      }

      const loadingToast = toast.loading(
        t("activity:comment.editor.uploadingFile"),
      );

      try {
        const uploadedAsset = await uploadTaskImage({
          taskId: resolvedTaskId,
          surface: uploadSurfaceRef.current,
          file,
        });
        insertUploadedAsset(activeEditor, uploadedAsset, range);

        toast.dismiss(loadingToast);
        toast.success(
          uploadedAsset.kind === "image"
            ? t("activity:comment.editor.imageUploaded")
            : t("activity:comment.editor.fileAttached"),
        );
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error(
          error instanceof Error
            ? error.message
            : t("activity:comment.editor.failedToUploadFile"),
        );
      }
    },
    [insertUploadedAsset, t],
  );

  const canUploadFiles = Boolean(taskId || ensureTaskId);

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
      if (readOnly || disabled || !canUploadFiles || !hasFileDrag(event)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDragActive(true);
    },
    [canUploadFiles, disabled, hasFileDrag, readOnly],
  );

  const handleShellDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (readOnly || disabled || !canUploadFiles || !hasFileDrag(event)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDragActive) {
        setIsDragActive(true);
      }
    },
    [canUploadFiles, disabled, hasFileDrag, isDragActive, readOnly],
  );

  const handleShellDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (readOnly || disabled || !canUploadFiles || !hasFileDrag(event)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragActive(false);
      }
    },
    [canUploadFiles, disabled, hasFileDrag, readOnly],
  );

  const handleShellDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (readOnly || disabled || !canUploadFiles || !hasFileDrag(event)) {
        return;
      }
      dragDepthRef.current = 0;
      setIsDragActive(false);
    },
    [canUploadFiles, disabled, hasFileDrag, readOnly],
  );

  const slashCommands = useMemo<SlashCommand[]>(
    () => [
      {
        id: "paragraph",
        label: t("activity:comment.editor.slashParagraph"),
        group: "text",
        search: t("activity:comment.editor.searchParagraph"),
        run: (activeEditor, range) => {
          activeEditor.chain().focus().deleteRange(range).setParagraph().run();
        },
      },
      {
        id: "heading-2",
        label: t("activity:comment.editor.slashHeading"),
        group: "text",
        shortcut: "Ctrl Alt 2",
        search: t("activity:comment.editor.searchHeading"),
        run: (activeEditor, range) => {
          activeEditor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleHeading({ level: 2 })
            .run();
        },
      },
      {
        id: "bullet-list",
        label: t("activity:comment.editor.slashBulletList"),
        group: "lists",
        shortcut: "Ctrl Alt 8",
        search: t("activity:comment.editor.searchBulletList"),
        run: (activeEditor, range) => {
          activeEditor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleBulletList()
            .run();
        },
      },
      {
        id: "task-list",
        label: t("activity:comment.editor.slashTaskList"),
        group: "lists",
        search: t("activity:comment.editor.searchTaskList"),
        run: (activeEditor, range) => {
          activeEditor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleTaskList()
            .run();
        },
      },
      {
        id: "ordered-list",
        label: t("activity:comment.editor.slashOrderedList"),
        group: "lists",
        shortcut: "Ctrl Alt 9",
        search: t("activity:comment.editor.searchOrderedList"),
        run: (activeEditor, range) => {
          activeEditor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleOrderedList()
            .run();
        },
      },
      {
        id: "blockquote",
        label: t("activity:comment.editor.slashQuote"),
        group: "insert",
        search: t("activity:comment.editor.searchQuote"),
        run: (activeEditor, range) => {
          activeEditor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleBlockquote()
            .run();
        },
      },
      {
        id: "code-block",
        label: t("activity:comment.editor.slashCodeBlock"),
        group: "insert",
        shortcut: "Ctrl Alt \\",
        search: t("activity:comment.editor.searchCodeBlock"),
        run: (activeEditor, range) => {
          activeEditor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleCodeBlock()
            .run();
        },
      },
      {
        id: "table",
        label: t("activity:comment.editor.slashTable"),
        group: "insert",
        search: t("activity:comment.editor.searchTable"),
        run: (activeEditor, range) => {
          activeEditor
            .chain()
            .focus()
            .deleteRange(range)
            .insertTable({ cols: 3, rows: 3 })
            .run();
        },
      },
      {
        id: "file",
        label: t("activity:comment.editor.slashFile"),
        group: "insert",
        search: t("activity:comment.editor.searchFile"),
        run: (activeEditor, range) => {
          activeEditor.chain().focus().deleteRange(range).run();
          openImagePicker(activeEditor);
        },
      },
    ],
    [openImagePicker, t],
  );

  useEffect(() => {
    let mounted = true;

    void getSharedShikiHighlighter().then((instance) => {
      if (!mounted) return;
      shikiHighlighterRef.current = instance;
      setShikiHighlighter(instance);
    });

    return () => {
      mounted = false;
    };
  }, []);
  const filteredSlashCommands = useMemo(() => {
    const query = slashMenu?.query.trim().toLowerCase() || "";
    if (!query) return slashCommands;
    return slashCommands.filter(
      (command) =>
        command.label.toLowerCase().includes(query) ||
        command.search.includes(query),
    );
  }, [slashCommands, slashMenu?.query]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      autofocus: autoFocus,
      editable: !readOnly && !disabled,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          trailingNode: false,
          codeBlock: {
            HTMLAttributes: { class: "kaneo-tiptap-codeblock" },
          },
        }),
        Link.configure({
          autolink: true,
          defaultProtocol: "https",
          linkOnPaste: true,
          openOnClick: readOnly,
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
          placeholder: resolvedPlaceholder,
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
          class: cn(
            proseClassName || "kaneo-comment-editor-prose",
            readOnly && "kaneo-comment-editor-prose-readonly",
          ),
        },
        handlePaste: (view, event) => {
          if (readOnly || disabled) return false;

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
          setEmbedComposerError(null);
          return true;
        },
        handleDrop: (view, event) => {
          if (readOnly || disabled) return false;

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
          if (readOnly || disabled || text !== "`") return false;

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
        handleKeyDown: (_view, event) => {
          if (!readOnly && !disabled && slashMenu) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSlashMenu((current) => {
                if (!current) return current;
                return {
                  ...current,
                  selectedIndex:
                    (current.selectedIndex + 1) %
                    Math.max(filteredSlashCommands.length, 1),
                };
              });
              return true;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setSlashMenu((current) => {
                if (!current) return current;
                return {
                  ...current,
                  selectedIndex:
                    (current.selectedIndex -
                      1 +
                      Math.max(filteredSlashCommands.length, 1)) %
                    Math.max(filteredSlashCommands.length, 1),
                };
              });
              return true;
            }

            if (
              (event.key === "Enter" || event.key === "Tab") &&
              filteredSlashCommands.length
            ) {
              event.preventDefault();
              if (!editor) return true;
              const command =
                filteredSlashCommands[
                  Math.min(
                    slashMenu.selectedIndex,
                    filteredSlashCommands.length - 1,
                  )
                ];
              if (command) {
                command.run(editor, { from: slashMenu.from, to: slashMenu.to });
                setSlashMenu(null);
              }
              return true;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setSlashMenu(null);
              return true;
            }
          }

          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            const submit = onSubmitShortcutRef.current;
            if (!readOnly && !disabled && submit) {
              event.preventDefault();
              submit();
              return true;
            }
          }

          if (
            event.key === "Escape" &&
            !readOnly &&
            !disabled &&
            onCancelShortcutRef.current
          ) {
            event.preventDefault();
            onCancelShortcutRef.current();
            return true;
          }

          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "a" &&
            editor
          ) {
            const { state } = editor.view;
            const { $from } = state.selection;
            if ($from.parent.type.name === "codeBlock") {
              event.preventDefault();
              editor.view.dispatch(
                state.tr.setSelection(
                  TextSelection.create(state.doc, $from.start(), $from.end()),
                ),
              );
              return true;
            }
          }

          return false;
        },
      },
      onUpdate: ({ editor: activeEditor }) => {
        if (readOnly || disabled || !onChange || isSyncingRef.current) return;
        const markdown = normalizeMarkdown(activeEditor.getMarkdown());
        latestValueRef.current = markdown;
        onChange(markdown);
      },
    },
    [handleAssetFileUpload, resolvedPlaceholder, toShikiLanguage],
  );

  useEffect(() => {
    if (!onAttachActionChange) return;

    onAttachActionChange(editor ? () => openImagePicker(editor) : null);

    return () => {
      onAttachActionChange(null);
    };
  }, [editor, onAttachActionChange, openImagePicker]);

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
        alt: target.alt || t("activity:comment.editor.previewImageAlt"),
      });
    };

    const dom = editor.view.dom;
    dom.addEventListener("click", handleImagePreviewClick);

    return () => {
      dom.removeEventListener("click", handleImagePreviewClick);
    };
  }, [editor, t]);

  const updateSlashMenu = useCallback(
    (activeEditor: Editor) => {
      if (readOnly || disabled) {
        setSlashMenu(null);
        return;
      }

      const { state, view } = activeEditor;
      const { selection } = state;
      if (!selection.empty) {
        setSlashMenu(null);
        return;
      }

      const { $from } = selection;
      if (!$from.parent.isTextblock) {
        setSlashMenu(null);
        return;
      }

      const textBefore = $from.parent.textBetween(
        0,
        $from.parentOffset,
        "\0",
        "\0",
      );
      const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);
      if (!match) {
        setSlashMenu(null);
        return;
      }

      const query = match[1] || "";
      const matchText = match[0];
      const startsWithSpace = matchText.startsWith(" ");
      const slashOffset =
        $from.parentOffset - matchText.length + (startsWithSpace ? 1 : 0);
      const from = $from.start() + slashOffset;
      const to = from + matchText.trimStart().length;
      const { top, left } = getOverlayPosition(view, $from.pos);

      setSlashMenu((current) => ({
        from,
        to,
        query,
        top,
        left,
        selectedIndex: current?.query === query ? current.selectedIndex : 0,
      }));
    },
    [disabled, getOverlayPosition, readOnly],
  );

  useEffect(() => {
    if (!editor) return;
    const syncSlash = () => updateSlashMenu(editor);
    editor.on("selectionUpdate", syncSlash);
    editor.on("update", syncSlash);

    return () => {
      editor.off("selectionUpdate", syncSlash);
      editor.off("update", syncSlash);
    };
  }, [editor, updateSlashMenu]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly && !disabled);
  }, [disabled, editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    if (lastEditorRef.current !== editor) {
      hasHydratedRef.current = false;
      lastEditorRef.current = editor;
    }

    const incoming = normalizeMarkdown(value || "");
    if (!hasHydratedRef.current) {
      isSyncingRef.current = true;
      latestValueRef.current = incoming;
      editor.commands.setContent(incoming, {
        emitUpdate: false,
        contentType: "markdown",
      });
      hasHydratedRef.current = true;
      queueMicrotask(() => {
        isSyncingRef.current = false;
      });
      return;
    }

    if (incoming === latestValueRef.current) return;
    isSyncingRef.current = true;
    editor.commands.setContent(incoming, {
      emitUpdate: false,
      contentType: "markdown",
    });
    latestValueRef.current = incoming;
    queueMicrotask(() => {
      isSyncingRef.current = false;
    });
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (readOnly || disabled || !editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      t("activity:comment.editor.enterUrl"),
      previousUrl || "",
    );
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [disabled, editor, readOnly, t]);

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
    (element: HTMLElement | null) => {
      if (!editor || !element) {
        if (!isCodeLanguageMenuOpen) {
          hoveredCodeBlockElementRef.current = null;
          setHoveredCodeBlock(null);
        }
        return;
      }

      const view = editor.view;
      const pos = view.posAtDOM(element, 0);
      const nodeData = resolveCodeBlockNodeData(pos);
      if (!nodeData) return;

      const rect = element.getBoundingClientRect();
      const shellRect = editorShellRef.current?.getBoundingClientRect();
      const top =
        slashMenuPosition === "fixed" || !shellRect
          ? rect.top + 6
          : rect.top - shellRect.top + 6;
      const left =
        slashMenuPosition === "fixed" || !shellRect
          ? rect.right - 12
          : rect.right - shellRect.left - 12;
      setHoveredCodeBlock((current) => {
        if (current?.nodePos !== nodeData.nodePos) {
          setIsCodeCopied(false);
        }

        return {
          language: nodeData.language.toLowerCase(),
          nodePos: nodeData.nodePos,
          top,
          left,
        };
      });
      hoveredCodeBlockElementRef.current = element;
    },
    [
      editor,
      isCodeLanguageMenuOpen,
      resolveCodeBlockNodeData,
      slashMenuPosition,
    ],
  );

  const setCodeLanguage = useCallback(
    (language: string) => {
      if (!editor || !hoveredCodeBlock) return;
      const resolvedLanguage = language === "auto" ? "" : language;
      const { nodePos } = hoveredCodeBlock;
      const node = editor.state.doc.nodeAt(nodePos);
      if (!node || node.type.name !== "codeBlock") return;

      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(nodePos, undefined, {
            ...node.attrs,
            language: resolvedLanguage,
          });
          return true;
        })
        .run();

      setHoveredCodeBlock((current) =>
        current ? { ...current, language } : current,
      );
    },
    [editor, hoveredCodeBlock],
  );

  const activeCodeLanguageLabel = useMemo(() => {
    if (!hoveredCodeBlock) return t("activity:comment.editor.plaintext");
    if (hoveredCodeBlock.language === "auto")
      return t("activity:comment.editor.autoDetect");

    const match = codeLanguages.find(
      (option) => option.value === hoveredCodeBlock.language,
    );
    return match?.label || hoveredCodeBlock.language;
  }, [codeLanguages, hoveredCodeBlock, t]);

  useEffect(() => {
    if (!hoveredCodeBlock || isCodeLanguageMenuOpen) return;

    const syncPosition = () => {
      const element = hoveredCodeBlockElementRef.current;
      if (!element) return;
      updateHoveredCodeBlockFromElement(element);
    };

    window.addEventListener("scroll", syncPosition, true);
    window.addEventListener("resize", syncPosition);
    return () => {
      window.removeEventListener("scroll", syncPosition, true);
      window.removeEventListener("resize", syncPosition);
    };
  }, [
    hoveredCodeBlock,
    isCodeLanguageMenuOpen,
    updateHoveredCodeBlockFromElement,
  ]);

  const groupedSlashCommands = useMemo(
    () => [
      {
        title: t("activity:comment.editor.slashGroupText"),
        items: filteredSlashCommands.filter(
          (command) => command.group === "text",
        ),
      },
      {
        title: t("activity:comment.editor.slashGroupLists"),
        items: filteredSlashCommands.filter(
          (command) => command.group === "lists",
        ),
      },
      {
        title: t("activity:comment.editor.slashGroupInsert"),
        items: filteredSlashCommands.filter(
          (command) => command.group === "insert",
        ),
      },
    ],
    [filteredSlashCommands, t],
  );

  const submitEmbedComposer = useCallback(
    (mode: "embed" | "link") => {
      if (!editor || !embedComposer) return;
      const url = normalizeUrl(embedComposer.url);
      if (!url) {
        setEmbedComposerError("embedErrorInvalidUrl");
        return;
      }

      const chain = editor.chain().focus();
      if (embedComposer.mode === "choice" && mode === "link") {
        setEmbedComposer(null);
        setEmbedComposerError(null);
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
          setEmbedComposerError("embedErrorYoutubeOnly");
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
      setEmbedComposerError(null);
    },
    [editor, embedComposer],
  );

  useEffect(() => {
    if (!embedComposer) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!embedComposer) return;
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (embedComposer.mode === "choice") {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          return;
        }

        if (event.key === "Tab") {
          event.preventDefault();
          submitEmbedComposer("embed");
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setEmbedComposer(null);
          setEmbedComposerError(null);
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          submitEmbedComposer("embed");
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setEmbedComposer(null);
        setEmbedComposerError(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [embedComposer, submitEmbedComposer]);

  const handleEditorMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (disabled) return;
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

      if (codeLanguageHideTimeoutRef.current !== null) {
        window.clearTimeout(codeLanguageHideTimeoutRef.current);
        codeLanguageHideTimeoutRef.current = null;
      }
      updateHoveredCodeBlockFromElement(hovered);
    },
    [disabled, isCodeLanguageMenuOpen, updateHoveredCodeBlockFromElement],
  );

  const handleEditorMouseLeave = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      if (relatedTarget?.closest(".kaneo-codeblock-language")) return;
      if (isCodeLanguageMenuOpen) return;

      if (codeLanguageHideTimeoutRef.current !== null) {
        window.clearTimeout(codeLanguageHideTimeoutRef.current);
      }

      codeLanguageHideTimeoutRef.current = window.setTimeout(() => {
        codeLanguageHideTimeoutRef.current = null;
        const pickerIsHovered = Boolean(
          document.querySelector(".kaneo-codeblock-language:hover"),
        );
        if (pickerIsHovered || isCodeLanguageMenuOpen) return;

        hoveredCodeBlockElementRef.current = null;
        setHoveredCodeBlock(null);
      }, 40);
    },
    [isCodeLanguageMenuOpen],
  );

  useEffect(() => {
    return () => {
      if (codeLanguageHideTimeoutRef.current !== null) {
        window.clearTimeout(codeLanguageHideTimeoutRef.current);
      }
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

  return (
    <section
      ref={editorShellRef}
      aria-label={
        readOnly
          ? t("activity:comment.editor.ariaCommentContent")
          : t("activity:comment.editor.ariaCommentEditor")
      }
      className={cn(
        "kaneo-comment-editor-shell",
        isDragActive && "is-drag-active",
        readOnly && "kaneo-comment-editor-shell-readonly",
        className,
      )}
      onDragEnter={handleShellDragEnter}
      onDragOver={handleShellDragOver}
      onDragLeave={handleShellDragLeave}
      onDrop={handleShellDrop}
    >
      {!readOnly && !disabled && (
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
      )}
      {editor && hoveredCodeBlock && !disabled && (
        <div
          className="kaneo-codeblock-language"
          style={{
            top: hoveredCodeBlock.top,
            left: hoveredCodeBlock.left,
            position: slashMenuPosition,
          }}
        >
          <button
            type="button"
            className="kaneo-codeblock-language-trigger kaneo-codeblock-copy-trigger"
            aria-label={
              isCodeCopied
                ? t("activity:comment.editor.ariaCopied")
                : t("activity:comment.editor.ariaCopyCode")
            }
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
            <span>
              {isCodeCopied
                ? t("activity:comment.editor.copied")
                : t("activity:comment.editor.copy")}
            </span>
          </button>
          {!readOnly && (
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
                    {t("activity:comment.editor.autoDetect")}
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
          )}
        </div>
      )}
      {editor && !readOnly && !disabled && showBubbleMenu && (
        <BubbleMenu
          editor={editor}
          className="kaneo-comment-editor-bubble"
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
              "kaneo-comment-editor-bubble-btn",
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
              "kaneo-comment-editor-bubble-btn",
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
              "kaneo-comment-editor-bubble-btn",
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
              "kaneo-comment-editor-bubble-btn",
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
              "kaneo-comment-editor-bubble-btn",
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
              "kaneo-comment-editor-bubble-btn",
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
              "kaneo-comment-editor-bubble-btn",
              editor.isActive("link") && "bg-accent text-accent-foreground",
            )}
            onClick={setLink}
          >
            <Link2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="kaneo-comment-editor-bubble-btn"
            onClick={() => openImagePicker(editor)}
          >
            <Paperclip className="size-3.5" />
          </Button>
        </BubbleMenu>
      )}
      {slashMenu && !readOnly && !disabled && (
        <div
          className="kaneo-tiptap-slash-menu"
          style={{
            top: slashMenu.top,
            left: slashMenu.left,
            position: slashMenuPosition,
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
                          if (!editor) return;
                          command.run(editor, {
                            from: slashMenu.from,
                            to: slashMenu.to,
                          });
                          setSlashMenu(null);
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
            <div className="kaneo-tiptap-slash-empty">
              {t("activity:comment.editor.noCommands")}
            </div>
          )}
        </div>
      )}
      {editor && embedComposer && (
        <div
          className="kaneo-embed-composer"
          style={{
            top: embedComposer.top,
            left: embedComposer.left,
            position: slashMenuPosition,
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
                <span>{t("activity:comment.editor.embedVideo")}</span>
                <span className="kaneo-embed-choice-hint">
                  {t("activity:comment.editor.hintTab")}
                </span>
              </button>
              <button
                type="button"
                className="kaneo-embed-choice-item"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setEmbedComposer(null);
                  setEmbedComposerError(null);
                }}
              >
                <span>{t("activity:comment.editor.keepAsLink")}</span>
                <span className="kaneo-embed-choice-hint">
                  {t("activity:comment.editor.hintEsc")}
                </span>
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
                  if (embedComposerError) setEmbedComposerError(null);
                }}
                placeholder={t("activity:comment.editor.pasteUrl")}
                autoFocus
              />
              <div className="kaneo-embed-composer-actions">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => submitEmbedComposer("link")}
                >
                  {t("activity:comment.editor.asLink")}
                </Button>
                <Button type="submit" size="xs">
                  {t("activity:comment.editor.embed")}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setEmbedComposer(null);
                    setEmbedComposerError(null);
                  }}
                >
                  {t("common:actions.cancel")}
                </Button>
              </div>
              {embedComposerError && (
                <p className="kaneo-embed-composer-error">
                  {t(`activity:comment.editor.${embedComposerError}`)}
                </p>
              )}
            </form>
          )}
        </div>
      )}
      <EditorContent
        editor={editor}
        className={cn("kaneo-comment-editor-content", contentClassName)}
        onMouseMove={handleEditorMouseMove}
        onMouseLeave={handleEditorMouseLeave}
      />
      {!readOnly && !disabled && showQuickAttachButton && (
        <button
          type="button"
          className="kaneo-editor-quick-attach"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => openImagePicker(editor)}
          aria-label={t("activity:comment.attachFile")}
        >
          <Paperclip className="size-3.5" />
        </button>
      )}
      {isDragActive && (
        <div className="kaneo-editor-drop-indicator">
          <span>{t("activity:comment.editor.dropImageToUpload")}</span>
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
