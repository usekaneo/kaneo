import { useTranslation } from "react-i18next";

export function ColumnListHeader() {
  const { t } = useTranslation();

  return (
    <div
      aria-hidden="true"
      className="flex h-8 items-center gap-2.5 px-4 text-xs text-muted-foreground"
    >
      <span className="flex-1 pl-6">
        {t("settings:columnEditor.columnHeader")}
      </span>
      <span className="w-13 shrink-0 text-center">
        {t("settings:columnEditor.doneHeader")}
      </span>
      <span className="w-7 shrink-0" />
    </div>
  );
}
