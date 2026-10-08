import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AssignedTaskRow } from "@/components/my-work/assigned-task-row";
import { Skeleton } from "@/components/ui/skeleton";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { SectionHeader } from "./section-header";

type UpNextProps = {
  tasks: AssignedTask[] | undefined;
  total: number;
  isLoading: boolean;
  isError: boolean;
  workspaceId: string;
};

const VISIBLE_TASKS = 5;

export function UpNext({
  tasks,
  total,
  isLoading,
  isError,
  workspaceId,
}: UpNextProps) {
  const { t } = useTranslation();

  return (
    <section>
      <SectionHeader
        title={t("workspace:home.upNext.title")}
        detail={
          total > 0
            ? t("workspace:home.upNext.assigned", { count: total })
            : undefined
        }
        action={
          total > 0 ? (
            <Link
              to="/dashboard/workspace/$workspaceId/my-tasks"
              params={{ workspaceId }}
              className="shrink-0 font-medium text-[13px] text-muted-foreground hover:text-foreground"
            >
              {t("workspace:home.upNext.viewAll")}
            </Link>
          ) : null
        }
      />

      {isLoading ? (
        <div className="flex flex-col">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex h-11 items-center gap-3 border-border/50 border-b px-1"
            >
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      ) : isError && !tasks ? (
        <p role="alert" className="py-6 text-muted-foreground text-sm">
          {t("workspace:myWork.loadError")}
        </p>
      ) : !tasks?.length ? (
        <p className="py-6 text-muted-foreground text-sm">
          {t("workspace:myWork.empty")}
        </p>
      ) : (
        <div className="flex flex-col">
          {tasks.slice(0, VISIBLE_TASKS).map((task) => (
            <AssignedTaskRow
              key={task.id}
              task={task}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
