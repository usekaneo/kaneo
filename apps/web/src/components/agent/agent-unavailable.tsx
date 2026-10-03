import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AgentUnavailable() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-border border-dashed p-5">
      <Sparkles aria-hidden="true" className="size-4 text-muted-foreground" />
      <p className="font-medium text-foreground text-sm">
        {t("agent:unavailable.title")}
      </p>
      <p className="text-muted-foreground text-sm">
        {t("agent:unavailable.description")}
      </p>
    </div>
  );
}
