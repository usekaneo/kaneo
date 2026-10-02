import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TrialExpiredCallout } from "@/components/billing/trial-expired-callout";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { ActivityFeed } from "@/components/home/activity-feed";
import { getDayPart } from "@/components/home/day-part";
import { HomeProjects } from "@/components/home/home-projects";
import { UpNext } from "@/components/home/up-next";
import { WeekStrip } from "@/components/home/week-strip";
import PageTitle from "@/components/page-title";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Button } from "@/components/ui/button";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";
import { useLocalDay } from "@/hooks/use-local-day";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const day = useLocalDay();
  const { workspaceId } = Route.useParams();
  const {
    data: assigned,
    isLoading,
    isError,
  } = useGetAssignedTasks(workspaceId);
  const { canCreateTasks } = useWorkspacePermission();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  const greetings = {
    morning: t("workspace:home.greeting.morning"),
    afternoon: t("workspace:home.greeting.afternoon"),
    evening: t("workspace:home.greeting.evening"),
  };

  return (
    <>
      <PageTitle title={t("workspace:home.pageTitle")} />
      <WorkspaceLayout title={t("workspace:home.pageTitle")}>
        <div className="h-full overflow-y-auto">
          <TrialExpiredCallout workspaceId={workspaceId} className="m-4" />
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-9 px-6 py-10 lg:px-10">
            <header className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <p className="font-medium text-[13px] text-muted-foreground">
                  {formatDate(new Date(day), {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <h1 className="font-semibold text-3xl text-foreground tracking-tight">
                  {greetings[getDayPart()]}
                </h1>
              </div>
              {canCreateTasks() && (
                <Button size="sm" onClick={() => setIsCreateTaskOpen(true)}>
                  <Plus />
                  {t("workspace:home.newTask")}
                </Button>
              )}
            </header>

            <WeekStrip
              tasks={assigned?.tasks ?? []}
              workspaceId={workspaceId}
            />

            {assigned && assigned.total > assigned.tasks.length && (
              <p className="text-muted-foreground text-xs">
                {t("workspace:home.week.truncated", {
                  shown: assigned.tasks.length,
                  total: assigned.total,
                })}
              </p>
            )}

            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="flex min-w-0 flex-col gap-9">
                <UpNext
                  tasks={assigned?.tasks}
                  total={assigned?.total ?? 0}
                  isLoading={isLoading}
                  isError={isError}
                  workspaceId={workspaceId}
                />
                <HomeProjects workspaceId={workspaceId} />
              </div>
              <ActivityFeed workspaceId={workspaceId} />
            </div>
          </div>
        </div>
      </WorkspaceLayout>

      <CreateTaskModal
        open={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
      />
    </>
  );
}
