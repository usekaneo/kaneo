import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import { columnVariants } from "@/components/kanban-board/column";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import type useGlobalBoardTasks from "@/hooks/queries/task/use-global-board-tasks";
import GlobalBoardCard from "./global-board-card";
import type { GlobalBoardLane } from "./global-board-filters";
import { useLoadMoreOnScroll } from "./use-load-more-on-scroll";

type GlobalBoardLaneProps = {
  lane: GlobalBoardLane;
  title: string;
  description?: string;
  query: ReturnType<typeof useGlobalBoardTasks>;
  /** The cards to render, including any drag preview. */
  tasks: GlobalBoardTask[];
  projects: Map<string, GlobalBoardProject>;
  canMoveIn: (workspaceId: string) => boolean;
  onMenuMove: (
    task: GlobalBoardTask,
    from: GlobalBoardLane,
    column?: GlobalBoardProject["columns"][number],
  ) => void;
};

export function GlobalBoardLaneColumn({
  lane,
  title,
  description,
  query,
  tasks,
  projects,
  canMoveIn,
  onMenuMove,
}: GlobalBoardLaneProps) {
  const { t } = useTranslation();
  // Shaped like a project board column so the board's collision detection
  // can pick the card under the pointer.
  const { setNodeRef, isOver } = useDroppable({
    id: lane,
    data: { type: "column", column: { tasks }, lane },
  });
  const loaded = query.data?.pages.flatMap((page) => page.tasks).length ?? 0;
  const total = query.data?.pages.at(-1)?.pagination.total ?? 0;
  const loadMoreRef = useLoadMoreOnScroll(query);

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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-1.5 pt-1.5 pb-1.5 [-webkit-overflow-scrolling:touch]">
          {query.isLoading ? (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-20 w-full rounded-lg" />
              ))}
            </div>
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
          ) : (
            <SortableContext
              items={tasks.map((task) => task.id)}
              strategy={verticalListSortingStrategy}
            >
              {/* min-h keeps an empty lane a drop target. */}
              <div className="flex min-h-16 flex-col gap-1.5">
                {tasks.length === 0 && (
                  <p className="p-2 text-muted-foreground text-xs">
                    {t("tasks:globalBoard.emptyLane")}
                  </p>
                )}
                {tasks.map((task, index) => (
                  <GlobalBoardCard
                    key={task.id}
                    task={task}
                    lane={lane}
                    project={projects.get(task.projectId)}
                    canMove={canMoveIn(task.workspaceId)}
                    onMove={(column) => onMenuMove(task, lane, column)}
                    onMoveToTop={
                      index > 0 ? () => onMenuMove(task, lane) : undefined
                    }
                  />
                ))}
              </div>
            </SortableContext>
          )}
          {query.hasNextPage && (
            <Button
              ref={loadMoreRef}
              variant="ghost"
              size="sm"
              className="mt-1.5 w-full shrink-0 text-muted-foreground"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage
                ? t("tasks:globalBoard.loadingMore")
                : t("tasks:globalBoard.loadMore", { count: total - loaded })}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
