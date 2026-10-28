import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AutosaveNote() {
  const { t } = useTranslation();

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckIcon aria-hidden="true" className="size-3.5" />
      {t("settings:shared.autosave")}
    </p>
  );
}
