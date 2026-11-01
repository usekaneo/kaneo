import { ArrowUp, Paperclip, Square } from "lucide-react";
import {
  type DragEvent,
  type ReactNode,
  type Ref,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AgentDraftAttachments } from "./agent-draft-attachments";
import { AgentReviewBadge } from "./agent-review-badge";
import {
  AgentPromptEditor,
  type AgentPromptEditorHandle,
} from "./mention/agent-prompt-editor";
import type { AgentMentionScope } from "./mention/use-agent-mention-search";
import { agentAttachmentAccept } from "./read-agent-attachments";
import type { AgentAttachments } from "./use-agent-attachments";

// The API's prompt limit, mention tokens included.
const MAX_PROMPT_LENGTH = 16000;

type AgentComposerProps = {
  value: string;
  onValueChange: (value: string) => void;
  attachments: AgentAttachments;
  onSubmit: (prompt: string) => void;
  onStop?: () => void;
  placeholder: string;
  // A run is working; sending is replaced by stopping it.
  running?: boolean;
  sending?: boolean;
  disabled?: boolean;
  variant?: "panel" | "hero";
  autoFocus?: boolean;
  inputRef?: Ref<AgentPromptEditorHandle>;
  modelPicker?: ReactNode;
  // Where @ searches tasks and projects.
  mentionScope: AgentMentionScope;
};

export function AgentComposer({
  value,
  onValueChange,
  attachments,
  onSubmit,
  onStop,
  placeholder,
  running = false,
  sending = false,
  disabled = false,
  variant = "panel",
  autoFocus,
  inputRef,
  modelPicker,
  mentionScope,
}: AgentComposerProps) {
  const { t } = useTranslation();
  const prompt = value.trim();
  const canSend =
    Boolean(prompt) &&
    prompt.length <= MAX_PROMPT_LENGTH &&
    !running &&
    !sending &&
    !disabled &&
    !attachments.uploading;
  const hero = variant === "hero";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const addAttachments = attachments.add;

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragging(false);
    if (!disabled) void addAttachments(Array.from(event.dataTransfer.files));
  };

  const submit = () => {
    if (canSend) onSubmit(prompt);
  };

  return (
    <form
      className={cn(
        "flex flex-col border border-border bg-card shadow-xs/5 focus-within:border-ring/60",
        hero ? "gap-4 rounded-2xl p-4 shadow-lg/5" : "gap-3 rounded-xl p-3",
        dragging && "border-info bg-info/4",
      )}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={handleDrop}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <AgentDraftAttachments
        items={attachments.items}
        onRemove={attachments.remove}
      />
      <AgentPromptEditor
        editorRef={inputRef}
        value={value}
        onValueChange={onValueChange}
        onSubmit={submit}
        onPasteFiles={(files) => void addAttachments(files)}
        placeholder={placeholder}
        mentionScope={mentionScope}
        menuPlacement={hero ? "below" : "above"}
        disabled={disabled}
        autoFocus={autoFocus}
        className={hero ? "min-h-12 text-base" : "min-h-5 text-sm"}
      />
      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            aria-label={t("agent:composer.attach")}
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip aria-hidden="true" className="size-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={agentAttachmentAccept}
            className="hidden"
            tabIndex={-1}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void addAttachments(files);
            }}
          />
          <AgentReviewBadge />
        </div>
        <div className="flex items-center gap-2.5">
          {modelPicker}
          {running && onStop ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className={cn("rounded-full", hero ? "size-8" : "size-7")}
              aria-label={t("agent:composer.stop")}
              onClick={onStop}
            >
              <Square aria-hidden="true" className="size-3 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className={cn("rounded-full", hero ? "size-8" : "size-7")}
              aria-label={t("agent:composer.send")}
              disabled={!canSend}
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
