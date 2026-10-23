import { useDroppable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { columnVariants } from "@/components/kanban-board/column";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import useGlobalBoardTasks from "@/hooks/queries/task/use-global-board-tasks";
import GlobalBoardCard from "./global-board-card";
import type {
  GlobalBoardFilters,
  GlobalBoardLane,
} from "./global-board-filters";

type GlobalBoardLaneProps = {
  lane: GlobalBoardLane;
  title: string;
  description?: string;
  filters: GlobalBoardFilters;
  projects: Map<string, GlobalBoardProject>;
  canMoveIn: (workspaceId: string) => boolean;
  onMove: (
    task: GlobalBoardTask,
    from: GlobalBoardLane,
    column: GlobalBoardProject["columns"][number],
  ) => void;
  hideWhenEmpty?: boolean;
};

export function GlobalBoardLaneColumn({
  lane,
  title,
  description,
  filters,
  projects,
  canMoveIn,
  onMove,
  hideWhenEmpty = false,
}: GlobalBoardLaneProps) {
  const { t } = useTranslation();
  const query = useGlobalBoardTasks(lane, filters);
  const { setNodeRef, isOver } = useDroppable({
    id: lane,
    data: { lane },
    disabled: lane === "unmapped",
  });
  const tasks = query.data?.pages.flatMap((page) => page.tasks) ?? [];
  const total = query.data?.pages.at(-1)?.pagination.total ?? 0;

  if (hideWhenEmpty && (query.isLoading || total === 0)) return null;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`global-board-lane-${lane}`}
      className="h-full max-w-96 min-w-[min(20rem,calc(100vw-4.5rem))] shrink-0 flex-1 snap-start"
    >
      <div className={columnVariants({ isDropzoneOver: isOver })}>
        <header className="shrink-0 px-3 pt-2.5 pb-1">
          <h2
            id={`global-board-lane-${lane}`}
            className="flex items-center gap-2 font-medium text-sm"
          >
            {title}
            <span className="font-normal text-muted-foreground text-xs tabular-nums">
              {total}
            </span>
          </h2>
          {description && (
            <p className="mt-0.5 text-muted-foreground text-xs">
              {description}
            </p>
          )}
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden px-1.5 pt-1.5 pb-1.5 [-webkit-overflow-scrolling:touch]">
          {query.isLoading ? (
            [0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-20 w-full rounded-lg" />
            ))
          ) : query.isError && !query.data ? (
            <div role="alert" className="flex flex-col items-start gap-2 p-2">
              <p className="text-muted-foreground text-xs">
                {t("tasks:globalBoard.loadError")}
              </p>
              <Button
                size="xs"
                variant="outline"
                onClick={() => query.refetch()}
              >
                {t("tasks:globalBoard.retry")}
              </Button>
            </div>
          ) : tasks.length === 0 ? (
            <p className="p-2 text-muted-foreground text-xs">
              {t("tasks:globalBoard.emptyLane")}
            </p>
          ) : (
            tasks.map((task) => {
              const project = projects.get(task.projectId);
              return (
                <GlobalBoardCard
                  key={task.id}
                  task={task}
                  lane={lane}
                  project={project}
                  canMove={canMoveIn(task.workspaceId)}
                  onMove={(column) => onMove(task, lane, column)}
                />
              );
            })
          )}
          {query.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full shrink-0 text-muted-foreground"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage
                ? t("tasks:globalBoard.loadingMore")
                : t("tasks:globalBoard.loadMore", {
                    count: total - tasks.length,
                  })}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
