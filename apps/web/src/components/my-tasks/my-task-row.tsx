import { useNavigate } from "@tanstack/react-router";
import { Calendar, CalendarClock, CalendarX, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import icons from "@/constants/project-icons";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { getStatusLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import type { MyTask } from "@/types/task/my-tasks";

type MyTaskRowProps = {
  task: MyTask;
  workspaceId: string;
};

function getUtcDayKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;

  return getUtcDayKey(new Date(dueDate)) === getUtcDayKey(new Date());
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;

  return getUtcDayKey(new Date(dueDate)) < getUtcDayKey(new Date());
}

export default function MyTaskRow({ task, workspaceId }: MyTaskRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const ProjectIcon =
    icons[(task.projectIcon || "Layout") as keyof typeof icons] || icons.Layout;
  const dueToday = !task.isFinal && isDueToday(task.dueDate);
  const overdue = !task.isFinal && isOverdue(task.dueDate);

  const handleOpenTask = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: {
        projectId: task.projectId,
        workspaceId,
      },
      search: { taskId: task.id },
    });
  };

  return (
    <button
      type="button"
      onClick={handleOpenTask}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-background/50 p-4 text-left transition-all duration-200 hover:border-border/80 hover:bg-background/80",
        overdue && "border-red-500/20 bg-red-500/5",
        dueToday && "border-orange-500/20 bg-orange-500/5",
      )}
    >
      <div className="flex items-start gap-4 pl-1">
        <div className="mt-1 flex-shrink-0">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl bg-muted/40 transition-colors duration-200 group-hover:bg-muted/60",
              task.priority === "urgent" &&
                "bg-red-500/10 text-red-600 dark:text-red-400",
              (task.priority === "high" || task.priority === "medium") &&
                "bg-orange-500/10 text-orange-600 dark:text-orange-400",
            )}
          >
            {getPriorityIcon(task.priority ?? "")}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-2">
              <h4
                className={cn(
                  "truncate text-[0.95rem] font-semibold tracking-tight text-foreground transition-colors duration-200",
                  task.isFinal &&
                    "text-muted-foreground line-through decoration-muted-foreground/40",
                )}
              >
                {task.title}
              </h4>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-foreground/70">
                  <ProjectIcon className="h-3.5 w-3.5 opacity-60" />
                  <span>{task.projectName}</span>
                  {task.number !== null && (
                    <span className="rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px] text-muted-foreground/70">
                      {task.projectSlug}-{task.number}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={task.isFinal ? "success" : "outline"}
                    size="sm"
                    className="rounded-full px-2"
                  >
                    {getStatusLabel(task.status)}
                  </Badge>

                  {task.labels?.slice(0, 2).map((label) => (
                    <Badge
                      key={label.id}
                      variant="outline"
                      size="sm"
                      className="rounded-full bg-muted/30 px-2"
                    >
                      {label.name}
                    </Badge>
                  ))}

                  {task.labels && task.labels.length > 2 && (
                    <span className="text-[10px] font-medium text-muted-foreground/60">
                      +{task.labels.length - 2}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {task.dueDate && (
              <div className="flex-shrink-0 self-start sm:self-center">
                <Badge
                  variant={overdue ? "error" : dueToday ? "warning" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 gap-1.5 rounded-xl px-2.5 transition-colors duration-200",
                    overdue && "bg-red-500/10 border-red-500/20",
                    dueToday && "bg-orange-500/10 border-orange-500/20",
                  )}
                >
                  {overdue ? (
                    <CalendarX className="h-3.5 w-3.5" />
                  ) : dueToday ? (
                    <CalendarClock className="h-3.5 w-3.5" />
                  ) : task.isFinal ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Calendar className="h-3.5 w-3.5" />
                  )}
                  <span className="font-semibold">
                    {overdue
                      ? t("workspace:myTasks.overdueBadge", {
                          date: formatDateShort(task.dueDate),
                        })
                      : dueToday
                        ? t("workspace:myTasks.dueTodayBadge")
                        : formatDateShort(task.dueDate)}
                  </span>
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
