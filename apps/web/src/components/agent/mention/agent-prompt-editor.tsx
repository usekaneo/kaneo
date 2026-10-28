import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { AgentMentionMenu, agentMentionOptionId } from "./agent-mention-menu";
import type { AgentMentionQuery } from "./agent-mention-suggestion";
import {
  cleanAgentMentionLabel,
  getAgentMentionRefs,
} from "./agent-mention-token";
import { createAgentPromptExtensions } from "./agent-prompt-extensions";
import { agentPromptToDoc } from "./agent-prompt-doc";
import type { AgentMentionOption } from "./to-agent-mention-options";
import {
  type AgentMentionScope,
  useAgentMentionSearch,
} from "./use-agent-mention-search";

export type AgentPromptEditorHandle = {
  focus: () => void;
  // Types "@" at the cursor, which opens the mention search.
  startMention: () => void;
};

type AgentPromptEditorProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onPasteFiles: (files: File[]) => void;
  placeholder: string;
  mentionScope: AgentMentionScope;
  menuPlacement: "above" | "below";
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  editorRef?: Ref<AgentPromptEditorHandle>;
  // Enter starts a new paragraph instead of submitting.
  multiline?: boolean;
  labelledBy?: string;
};

// Matches the API's per-prompt limit.
const MENTION_LIMIT = 10;

const promptOf = (editor: Editor) => editor.getText({ blockSeparator: "\n" });

export function AgentPromptEditor({
  value,
  onValueChange,
  onSubmit,
  onPasteFiles,
  placeholder,
  mentionScope,
  menuPlacement,
  disabled = false,
  autoFocus,
  className,
  editorRef,
  multiline = false,
  labelledBy,
}: AgentPromptEditorProps) {
  const { t } = useTranslation();
  const menuId = useId();
  const [mention, setMention] = useState<AgentMentionQuery | null>(null);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState({ query: "", index: 0 });
  const found = useAgentMentionSearch(mentionScope, mention?.query ?? null);
  const options =
    getAgentMentionRefs(value).length < MENTION_LIMIT ? found : [];
  const open = focused && mention !== null && options.length > 0;
  const activeIndex =
    highlight.query === mention?.query
      ? Math.min(highlight.index, options.length - 1)
      : 0;

  const attributes = useMemo(
    () => ({
      role: "textbox",
      "aria-multiline": "true",
      ...(labelledBy
        ? { "aria-labelledby": labelledBy }
        : { "aria-label": placeholder }),
      "aria-autocomplete": "list",
      ...(open
        ? {
            "aria-controls": menuId,
            "aria-activedescendant": agentMentionOptionId(menuId, activeIndex),
          }
        : {}),
      ...(disabled ? { "aria-disabled": "true" } : {}),
      class: cn(
        "kaneo-agent-prompt max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-foreground outline-none aria-disabled:opacity-60",
        className,
      ),
    }),
    [placeholder, labelledBy, open, menuId, activeIndex, disabled, className],
  );

  // ProseMirror keeps the callbacks it was created with; route them through a
  // ref so they always see the latest props and menu state.
  const latest = useRef({
    onSubmit,
    onValueChange,
    onPasteFiles,
    onMenuKey: (_event: KeyboardEvent): boolean => false,
    placeholder,
  });

  const editor = useEditor({
    extensions: createAgentPromptExtensions({
      placeholder: () => latest.current.placeholder,
      onMentionChange: setMention,
      onMentionKeyDown: (event) => latest.current.onMenuKey(event),
      onSubmit: () => latest.current.onSubmit(),
      submitOnEnter: !multiline,
    }),
    content: agentPromptToDoc(value),
    editable: !disabled,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes,
      handleDOMEvents: {
        // Runs before ProseMirror's own paste handling.
        paste: (_view, event) => {
          const files = Array.from(event.clipboardData?.files ?? []);
          if (files.length === 0) return false;
          event.preventDefault();
          latest.current.onPasteFiles(files);
          return true;
        },
      },
    },
    onUpdate: ({ editor }) => latest.current.onValueChange(promptOf(editor)),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  });

  const select = (option: AgentMentionOption) => {
    if (!editor || !mention) return;
    editor
      .chain()
      .focus()
      .insertContentAt(mention.range, [
        {
          type: "agentMention",
          attrs: {
            type: option.type,
            id: option.id,
            label: cleanAgentMentionLabel(option.label),
          },
        },
        { type: "text", text: " " },
      ])
      .run();
  };

  const handleMenuKey = (event: KeyboardEvent) => {
    if (!open) return false;
    const move = (step: number) =>
      setHighlight({
        query: mention?.query ?? "",
        index: (activeIndex + step + options.length) % options.length,
      });
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Enter" || event.key === "Tab") {
      const option = options[activeIndex];
      if (option) select(option);
    } else return false;
    return true;
  };

  latest.current = {
    onSubmit,
    onValueChange,
    onPasteFiles,
    onMenuKey: handleMenuKey,
    placeholder,
  };

  useImperativeHandle(
    editorRef,
    () => ({
      focus: () => editor?.commands.focus("end"),
      startMention: () => {
        if (!editor) return;
        // Mention search only starts after whitespace or at a line start.
        const { from } = editor.state.selection;
        const before = editor.state.doc.textBetween(
          Math.max(0, from - 1),
          from,
          "\n",
          " ",
        );
        const text = before && !/\s/.test(before) ? " @" : "@";
        editor.chain().focus().insertContent(text).run();
      },
    }),
    [editor],
  );

  // Drafts also change from outside: picked examples, clearing after send.
  useEffect(() => {
    if (!editor || promptOf(editor) === value) return;
    editor.commands.setContent(agentPromptToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled, false);
    editor.setOptions({
      editorProps: { ...editor.options.editorProps, attributes },
    });
  }, [editor, disabled, attributes]);

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      {open && (
        <AgentMentionMenu
          id={menuId}
          label={t("agent:composer.mentionResults")}
          options={options}
          activeIndex={activeIndex}
          placement={menuPlacement}
          onSelect={select}
          onHighlight={(index) =>
            setHighlight({ query: mention?.query ?? "", index })
          }
        />
      )}
    </div>
  );
}
