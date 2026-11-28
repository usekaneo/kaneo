import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type PluginFailedMessageProps = {
  className?: string;
};

export function PluginFailedMessage({ className }: PluginFailedMessageProps) {
  const { t } = useTranslation();

  return (
    <p
      role="alert"
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <TriangleAlert className="size-3.5 shrink-0 text-warning-foreground" />
      {t("common:plugins.failedToLoad")}
    </p>
  );
}
