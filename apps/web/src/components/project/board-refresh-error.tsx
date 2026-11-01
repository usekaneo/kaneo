import { CloudOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

type BoardRefreshErrorProps = {
  isRetrying: boolean;
  onRetry: () => void;
};

export function BoardRefreshError({
  isRetrying,
  onRetry,
}: BoardRefreshErrorProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-border/80 border-b px-4 py-2 text-[13px] text-muted-foreground"
    >
      <CloudOffIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{t("tasks:board.refreshError")}</span>
      <button
        type="button"
        className="cursor-pointer font-medium text-foreground underline decoration-foreground/40 underline-offset-[3px] outline-none transition-colors hover:decoration-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-64"
        disabled={isRetrying}
        onClick={onRetry}
      >
        {t("tasks:board.tryAgain")}
      </button>
    </div>
  );
}
