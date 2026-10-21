import { useDeferredValue, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { AssignedTaskRow } from "@/components/my-work/assigned-task-row";
import PageTitle from "@/components/page-title";
import { AssigneeAvatars } from "@/components/task/assignee-avatars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceTaskBoard } from "@/components/workspace-tasks/workspace-task-board";
import { WorkspaceTaskFilters } from "@/components/workspace-tasks/workspace-task-filters";
import type { WorkspaceTaskQuery } from "@/fetchers/task/get-workspace-tasks";
import { useWorkspaceTasks } from "@/hooks/queries/task/use-workspace-tasks";

export function WorkspaceTasks({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<WorkspaceTaskQuery>({
    completion: "all",
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState<"list" | "board">("list");
  const deferredSearch = useDeferredValue(search);
  const query = useWorkspaceTasks(
    workspaceId,
    { ...filters, search: deferredSearch },
    page,
  );
  useEffect(() => {
    if (query.data && !query.data.tasks.length && page > 1)
      setPage(Math.max(1, Math.ceil(query.data.total / 100)));
  }, [query.data, page]);
  const change = (next: WorkspaceTaskQuery) => {
    setFilters(next);
    setPage(1);
  };
  return (
    <>
      <PageTitle title={t("workspace:taskViews.title")} />
      <WorkspaceLayout title={t("workspace:taskViews.title")}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <Input
              className="w-52"
              aria-label={t("workspace:taskViews.search")}
              placeholder={t("workspace:taskViews.search")}
              value={search}
              maxLength={200}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <WorkspaceTaskFilters
              workspaceId={workspaceId}
              filters={filters}
              onChange={change}
            />
            <div
              role="group"
              aria-label={t("tasks:display.layout")}
              className="ml-auto flex gap-1"
            >
              {(["list", "board"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={layout === value ? "secondary" : "ghost"}
                  aria-pressed={layout === value}
                  onClick={() => setLayout(value)}
                >
                  {t(`tasks:view.${value}`)}
                </Button>
              ))}
            </div>
          </div>
          {layout === "board" && (
            <p className="border-b px-4 py-2 text-muted-foreground text-xs">
              {t("workspace:taskViews.boardNote")}
            </p>
          )}
          {query.isError && (
            <p role="alert" className="p-4 text-destructive">
              {t("workspace:myWork.loadError")}{" "}
              <Button variant="link" onClick={() => void query.refetch()}>
                {t("common:error.tryAgain")}
              </Button>
            </p>
          )}
          <div
            className="min-h-0 flex-1 overflow-auto"
            aria-busy={query.isFetching}
          >
            {query.isPending ? (
              <p role="status" className="p-4">
                {t("common:empty.loading")}
              </p>
            ) : !query.data?.tasks.length && !query.isError ? (
              <p className="p-6 text-muted-foreground">
                {t("workspace:taskViews.empty")}
              </p>
            ) : (
              query.data &&
              (layout === "board" ? (
                <WorkspaceTaskBoard
                  tasks={query.data.tasks}
                  workspaceId={workspaceId}
                />
              ) : (
                <div className="px-4">
                  {query.data.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <AssignedTaskRow
                          task={task}
                          workspaceId={workspaceId}
                          showLabels
                        />
                      </div>
                      <span className="sr-only">
                        {task.assignees.map((person) => person.name).join(", ")}
                      </span>
                      <AssigneeAvatars
                        task={{ userId: null, assignees: task.assignees }}
                        className="size-5"
                      />
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <p role="status" className="text-muted-foreground text-xs">
              {t("workspace:taskViews.count", {
                from: query.data?.tasks.length ? (page - 1) * 100 + 1 : 0,
                to: query.data?.tasks.length
                  ? (page - 1) * 100 + query.data.tasks.length
                  : 0,
                total: query.data?.total ?? 0,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1 || query.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                {t("common:pagination.previous")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !query.data ||
                  page * 100 >= query.data.total ||
                  query.isFetching
                }
                onClick={() => setPage((value) => value + 1)}
              >
                {t("common:pagination.next")}
              </Button>
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    </>
  );
}
