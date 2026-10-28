import { FileText, Paperclip, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";

type AgentAttachmentChipProps = {
  name: string;
  pdf?: boolean;
  uploading?: boolean;
  href?: string;
  onRemove?: () => void;
};

export function AgentAttachmentChip({
  name,
  pdf = false,
  uploading = false,
  href,
  onRemove,
}: AgentAttachmentChipProps) {
  const { t } = useTranslation();
  const Icon = pdf ? FileText : Paperclip;
  const label = <span className="truncate">{name}</span>;

  return (
    <span className="inline-flex h-7 min-w-0 max-w-56 items-center gap-1.5 rounded-md border border-border/80 bg-card pr-1 pl-2 font-medium text-foreground/80 text-xs">
      {uploading ? (
        <Spinner
          aria-label={t("agent:composer.uploading", { name })}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      ) : (
        <Icon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      )}
      {href ? (
        <a
          href={href}
          className="min-w-0 truncate hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {name}
        </a>
      ) : (
        label
      )}
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
