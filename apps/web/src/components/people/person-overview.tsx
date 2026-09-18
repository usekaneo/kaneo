import { useTranslation } from "react-i18next";
import type { PersonDetail } from "@/fetchers/people/get-person";
import type { PersonTask } from "@/fetchers/people/get-person-tasks";
import { formatDateMedium } from "@/lib/format";
import { describeSchedule } from "@/lib/schedule-format";
import { personStatusLabel, roleLabel } from "./labels";
import { taskCounts } from "./person-tasks";

type Props = {
  person: PersonDetail;
  tasks: PersonTask[];
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">{value || "–"}</dd>
    </div>
  );
}

export function PersonOverview({ person, tasks }: Props) {
  const { t, i18n } = useTranslation();
  const counts = taskCounts(tasks);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <dl className="divide-y divide-border">
        <Fact label={t("people:fields.email")} value={person.email} />
        <Fact
          label={t("people:fields.role")}
          value={roleLabel(t, person.role)}
        />
        <Fact label={t("people:fields.title")} value={person.title} />
        <Fact
          label={t("people:fields.department")}
          value={person.departmentName}
        />
        <Fact
          label={t("people:fields.joinDate")}
          value={person.joinDate ? formatDateMedium(person.joinDate) : null}
        />
        <Fact
          label={t("people:fields.status")}
          value={personStatusLabel(t, person.status)}
        />
        <Fact
          label={t("people:fields.workingHours")}
          value={describeSchedule(person.schedule, i18n.language)}
        />
      </dl>
      <dl className="divide-y divide-border">
        <Fact
          label={t("people:overview.openTasks")}
          value={String(counts.open)}
        />
        <Fact
          label={t("people:overview.overdueTasks")}
          value={
            counts.overdue > 0 ? (
              <span className="text-destructive">{counts.overdue}</span>
            ) : (
              "0"
            )
          }
        />
        <Fact
          label={t("people:overview.activeProjects")}
          value={String(counts.projects)}
        />
      </dl>
    </div>
  );
}
