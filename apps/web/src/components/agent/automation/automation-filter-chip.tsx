import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AutomationFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <span className="flex h-7 max-w-full items-center gap-1 rounded-md bg-muted ps-2 pe-0.5 text-foreground text-xs sm:h-6">
      <span className="truncate">{label}</span>
      <button
        type="button"
        className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("agent:automations.filters.remove", { name: label })}
        onClick={onRemove}
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </span>
  );
}
