import { ArrowUp, Paperclip, Square } from "lucide-react";
import {
  type DragEvent,
  type KeyboardEvent,
  type Ref,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AgentAttachmentChip } from "./agent-attachment-chip";
import { AgentReviewBadge } from "./agent-review-badge";
import {
  type AgentAttachmentDraft,
  agentAttachmentAccept,
} from "./read-agent-attachments";
import { useAddAgentAttachments } from "./use-add-agent-attachments";

type AgentComposerProps = {
  value: string;
  onValueChange: (value: string) => void;
  attachments: AgentAttachmentDraft[];
  onAttachmentsChange: (attachments: AgentAttachmentDraft[]) => void;
  onSubmit: (prompt: string) => void;
  onStop?: () => void;
  placeholder: string;
  // A run is working; sending is replaced by stopping it.
  running?: boolean;
  sending?: boolean;
  disabled?: boolean;
  variant?: "panel" | "hero";
  autoFocus?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
};

export function AgentComposer({
  value,
  onValueChange,
  attachments,
  onAttachmentsChange,
  onSubmit,
  onStop,
  placeholder,
  running = false,
  sending = false,
  disabled = false,
  variant = "panel",
  autoFocus,
  inputRef,
}: AgentComposerProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const prompt = value.trim();
  const canSend = Boolean(prompt) && !running && !sending && !disabled;
  const hero = variant === "hero";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const addAttachments = useAddAgentAttachments(
    attachments,
    onAttachmentsChange,
  );

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragging(false);
    if (!disabled) void addAttachments(Array.from(event.dataTransfer.files));
  };

  const submit = () => {
    if (canSend) onSubmit(prompt);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    event.preventDefault();
    submit();
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
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <textarea
        ref={inputRef}
        id={inputId}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={16000}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={hero ? 2 : 1}
        className={cn(
          "field-sizing-content max-h-48 resize-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60",
          hero ? "min-h-12 text-base" : "min-h-5 text-sm",
        )}
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
          {attachments.map((file) => (
            <AgentAttachmentChip
              key={file.name}
              name={file.name}
              onRemove={() =>
                onAttachmentsChange(
                  attachments.filter((item) => item.name !== file.name),
                )
              }
            />
          ))}
          <AgentReviewBadge />
        </div>
        <div className="flex items-center gap-2.5">
          {hero && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {t("agent:composer.enterToSend")}
            </span>
          )}
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
