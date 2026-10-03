import { Paperclip, X } from "lucide-react";
import { useTranslation } from "react-i18next";

type AgentAttachmentChipProps = {
  name: string;
  onRemove?: () => void;
};

export function AgentAttachmentChip({
  name,
  onRemove,
}: AgentAttachmentChipProps) {
  const { t } = useTranslation();

  return (
    <span className="inline-flex h-7 min-w-0 max-w-56 items-center gap-1.5 rounded-md border border-border/80 bg-card pr-1 pl-2 font-medium text-foreground/80 text-xs">
      <Paperclip
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <span className="truncate">{name}</span>
      {onRemove ? (
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("agent:composer.removeAttachment", { name })}
          onClick={onRemove}
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  );
}
