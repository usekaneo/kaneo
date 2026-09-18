import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import {
  ArrowRightLeft,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Flag,
  MessageSquare,
  Pencil,
  PlusCircle,
  ShieldCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ReportActivityItem, ReportQuery } from "@/fetchers/reports";
import { useReportActivity } from "@/hooks/queries/use-reports";
import { formatDateTime } from "@/lib/format";

const text = (data: ReportActivityItem["data"], key: string) => {
  const value = data?.[key];
  return typeof value === "string" ? value : "";
};

const human = (value: string) =>
  value.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function describe(t: TFunction, item: ReportActivityItem) {
  const who = item.actorName ?? t("reports:activity.someone");
  const task = item.taskTitle ?? "";
  const data = item.data;
  if (item.source === "audit") {
    const target = text(data, "targetName");
    switch (item.action) {
      case "leave.approved":
        return t("reports:activity.audit.leaveApproved", { who, target });
      case "leave.rejected":
        return t("reports:activity.audit.leaveRejected", { who, target });
      case "leave.cancelled":
        return t("reports:activity.audit.leaveCancelled", { who, target });
      case "expense.approved":
        return t("reports:activity.audit.expenseApproved", { who, target });
      case "expense.rejected":
        return t("reports:activity.audit.expenseRejected", { who, target });
      case "expense.paid":
        return t("reports:activity.audit.expensePaid", { who, target });
      case "attendance.created":
      case "attendance.updated":
      case "attendance.deleted":
        return t("reports:activity.audit.attendanceEdited", { who, target });
      case "payroll.approved":
        return t("reports:activity.audit.payrollApproved", { who });
      case "payroll.paid":
        return t("reports:activity.audit.payrollPaid", { who });
      default:
        return t("reports:activity.audit.other", {
          who,
          action: human(item.action.replace(".", " ")),
        });
    }
  }
  switch (item.action) {
    case "created":
    case "create":
      return t("reports:activity.task.created", { who, task });
    case "status_changed":
      return t("reports:activity.task.status", {
        who,
        task,
        status: human(text(data, "newStatus")),
      });
    case "assignee_changed":
      return text(data, "newAssignee")
        ? t("reports:activity.task.assigned", {
            who,
            task,
            assignee: text(data, "newAssignee"),
          })
        : t("reports:activity.task.assignedSomeone", { who, task });
    case "unassigned":
      return t("reports:activity.task.unassigned", { who, task });
    case "priority_changed":
      return t("reports:activity.task.priority", {
        who,
        task,
        priority: human(text(data, "newPriority")),
      });
    case "due_date_changed":
      return t("reports:activity.task.dueDate", { who, task });
    case "title_changed":
      return t("reports:activity.task.renamed", { who, task });
    case "moved":
      return t("reports:activity.task.moved", { who, task });
    case "comment":
      return t("reports:activity.task.comment", { who, task });
    default:
      return t("reports:activity.task.other", { who, task });
  }
}

function iconFor(item: ReportActivityItem) {
  if (item.source === "audit") return ShieldCheck;
  switch (item.action) {
    case "created":
    case "create":
      return PlusCircle;
    case "status_changed":
      return text(item.data, "newStatus").toLowerCase().includes("done")
        ? CheckCircle2
        : CircleDot;
    case "assignee_changed":
      return UserPlus;
    case "unassigned":
      return UserMinus;
    case "priority_changed":
      return Flag;
    case "due_date_changed":
      return CalendarClock;
    case "moved":
      return ArrowRightLeft;
    case "comment":
      return MessageSquare;
    default:
      return Pencil;
  }
}

// Who did what, newest first, grouped by day.
export function ActivityFeed({
  query,
  locale,
  timeZone,
}: {
  query: ReportQuery;
  locale: string;
  /** The workspace's zone, so days split where the company's days do. */
  timeZone: string;
}) {
  const { t } = useTranslation();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useReportActivity(query);
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) return null;
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-border border-dashed py-10 text-center text-muted-foreground text-sm">
        {t("reports:activity.empty")}
      </p>
    );
  }

  const groups: { day: string; items: ReportActivityItem[] }[] = [];
  for (const item of items) {
    const day = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone,
    }).format(new Date(item.createdAt));
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.day} className="space-y-2">
          <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            {group.day}
          </h3>
          <ol className="relative space-y-1 border-border border-s ps-5">
            {group.items.map((item) => {
              const Icon = iconFor(item);
              return (
                <li
                  key={`${item.source}-${item.id}`}
                  className="relative py-1.5"
                >
                  <span className="-start-[29px] absolute top-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-background">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </span>
                  <p className="text-sm">
                    {describe(t, item)}
                    {item.taskId && item.projectId && (
                      <>
                        {" · "}
                        <Link
                          to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                          params={{
                            workspaceId: query.workspaceId,
                            projectId: item.projectId,
                            taskId: item.taskId,
                          }}
                          className="text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {item.projectName}
                        </Link>
                      </>
                    )}
                  </p>
                  {item.action === "comment" && item.content && (
                    <p className="mt-1 line-clamp-2 rounded-md bg-muted/50 px-2 py-1 text-muted-foreground text-xs">
                      {item.content.replace(/<[^>]*>/g, " ")}
                    </p>
                  )}
                  <p
                    className="text-muted-foreground text-xs"
                    title={formatDateTime(item.createdAt)}
                  >
                    {new Intl.DateTimeFormat(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone,
                    }).format(new Date(item.createdAt))}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          disabled={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {t("reports:activity.more")}
        </Button>
      )}
    </div>
  );
}
