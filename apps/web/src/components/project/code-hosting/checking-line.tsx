import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";

export function CheckingLine() {
  const { t } = useTranslation();

  return (
    <p
      role="status"
      className="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <Spinner aria-hidden="true" role="presentation" className="size-3.5" />
      {t("settings:codeHosting.checking")}
    </p>
  );
}
