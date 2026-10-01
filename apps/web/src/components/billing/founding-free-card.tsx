import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export function FoundingFreeCard() {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-md border border-primary/30 bg-sidebar">
      <div className="flex items-start gap-3 p-5">
        <div className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="size-4.5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">
              {t("settings:billing.foundingFree.title")}
            </h3>
            <Badge variant="success" size="sm">
              {t("settings:billing.foundingFree.badge")}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("settings:billing.foundingFree.description")}
          </p>
        </div>
      </div>
    </div>
  );
}
