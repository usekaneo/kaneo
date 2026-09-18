import { useTranslation } from "react-i18next";
import { useCompanyToday } from "@/hooks/queries/company-os";
import { cn } from "@/lib/cn";
import { formatHours } from "@/lib/format-duration";

function Stat({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          attention && "text-destructive",
        )}
      >
        {value}
      </div>
      <div className="truncate text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// The six numbers an admin checks first, on one line. Nothing else.
export function CompanyToday({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data } = useCompanyToday(workspaceId);
  if (!data) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-border rounded-lg border border-border sm:grid-cols-3 sm:divide-x",
        data.openPayrolls !== null ? "lg:grid-cols-6" : "lg:grid-cols-5",
      )}
    >
      <Stat
        label={t("myWork:company.present")}
        value={`${data.present}/${data.people}`}
      />
      <Stat
        label={t("myWork:company.dueToday")}
        value={String(data.tasksDueToday)}
      />
      <Stat
        label={t("myWork:company.overdue")}
        value={String(data.overdueTasks)}
        attention={data.overdueTasks > 0}
      />
      <Stat
        label={t("myWork:company.workedToday")}
        value={formatHours(data.workedMinutesToday * 60)}
      />
      <Stat
        label={t("myWork:company.pendingLeave")}
        value={String(data.pendingLeave)}
      />
      {data.openPayrolls !== null && (
        <Stat
          label={t("myWork:company.openPayroll")}
          value={String(data.openPayrolls)}
        />
      )}
    </div>
  );
}
