import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import type { ContactTimeline } from "@/fetchers/contact";
import { followUpState } from "./follow-up-label";

type ContactLeadListProps = {
  leads: ContactTimeline["leads"];
};

const dueClass = {
  overdue: "text-destructive-foreground",
  today: "text-warning-foreground",
  upcoming: "text-muted-foreground",
  none: "text-muted-foreground",
} as const;

export function ContactLeadList({ leads }: ContactLeadListProps) {
  const { t } = useTranslation();

  if (leads.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("workspace:contacts.noLeads")}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border">
      {leads.map((lead) => (
        <li
          key={lead.id}
          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{lead.title}</p>
            <p className="truncate text-muted-foreground text-xs">
              {lead.projectName}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 text-xs",
              dueClass[followUpState(lead.dueDate)],
            )}
          >
            {lead.dueDate
              ? formatDateShort(lead.dueDate)
              : t("workspace:contacts.noFollowUp")}
          </span>
        </li>
      ))}
    </ul>
  );
}
