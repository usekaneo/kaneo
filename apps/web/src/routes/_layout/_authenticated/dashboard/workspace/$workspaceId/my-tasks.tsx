import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import {
  type MyTasksGroupBy,
  MyTasksGroupByToggle,
} from "@/components/my-tasks/my-tasks-group-by";
import { MyTasksList } from "@/components/my-tasks/my-tasks-list";
import PageTitle from "@/components/page-title";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const {
    data: assigned,
    isLoading,
    isError,
  } = useGetAssignedTasks(workspaceId);
  const [groupBy, setGroupBy] = useState<MyTasksGroupBy>("dueDate");

  return (
    <>
      <PageTitle title={t("workspace:myTasks.pageTitle")} />
      <WorkspaceLayout
        title={t("workspace:myTasks.pageTitle")}
        headerActions={
          assigned?.tasks.length ? (
            <MyTasksGroupByToggle value={groupBy} onChange={setGroupBy} />
          ) : null
        }
      >
        <div className="h-full overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col px-4">
              {[1, 2, 3, 4].map((row) => (
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
          ) : isError && !assigned ? (
            <p role="alert" className="p-6 text-muted-foreground text-sm">
              {t("workspace:myWork.loadError")}
            </p>
          ) : !assigned?.tasks.length ? (
            <Empty className="min-h-[60vh]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CircleCheck />
                </EmptyMedia>
                <EmptyTitle>{t("workspace:myWork.empty")}</EmptyTitle>
                <EmptyDescription>
                  {t("workspace:myTasks.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <MyTasksList
              tasks={assigned.tasks}
              total={assigned.total}
              groupBy={groupBy}
              workspaceId={workspaceId}
            />
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
