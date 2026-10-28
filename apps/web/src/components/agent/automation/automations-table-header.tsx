import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  AUTOMATION_TABLE_CELL,
  AUTOMATION_TABLE_GRID,
} from "./automation-table-grid";

const COLUMNS = ["scope", "output", "owner", "lastRun", "nextRun"] as const;

export function AutomationsTableHeader() {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden="true"
      className={cn(
        AUTOMATION_TABLE_GRID,
        "border-border/80 border-b pb-2 text-muted-foreground text-xs",
      )}
    >
      <span>{t("agent:automations.columns.name")}</span>
      {COLUMNS.map((column) => (
        <span key={column} className={cn(AUTOMATION_TABLE_CELL, "text-xs")}>
          {t(`agent:automations.columns.${column}`)}
        </span>
      ))}
      <span />
    </div>
  );
}
