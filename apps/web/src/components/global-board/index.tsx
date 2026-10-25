import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useReducedMotion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { boardCollisionDetection } from "@/components/kanban-board/board-collision-detection";
import type {
  GlobalBoardMeta,
  GlobalBoardProject,
} from "@/fetchers/task/get-global-board-meta";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import {
  type GlobalBoardMove,
  useMoveGlobalBoardTask,
} from "@/hooks/mutations/task/use-move-global-board-task";
import useGlobalBoardTasks from "@/hooks/queries/task/use-global-board-tasks";
import { cn } from "@/lib/cn";
import { EASE_OUT_CSS } from "@/lib/motion";
import { toast } from "@/lib/toast";
import { type BoardDrag, dropIndex, laneTasksDuringDrag } from "./board-drag";
import { type ColumnChoice, ColumnChoiceDialog } from "./column-choice-dialog";
import { GlobalBoardCardBody } from "./global-board-card-body";
import {
  GLOBAL_BOARD_LANES,
  type GlobalBoardFilters,
  type GlobalBoardLane,
} from "./global-board-filters";
import { GlobalBoardLaneColumn } from "./global-board-lane";
import { resolveDropTarget } from "./resolve-drop-target";
import { suppressNextClick } from "./suppress-next-click";

type ProjectColumn = GlobalBoardProject["columns"][number];

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.8" } },
  }),
  duration: 250,
  easing: EASE_OUT_CSS,
};

export function GlobalBoard({
  meta,
  filters,
}: {
  meta: GlobalBoardMeta;
  filters: GlobalBoardFilters;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [drag, setDrag] = useState<BoardDrag | null>(null);
  const [choice, setChoice] = useState<ColumnChoice | null>(null);
  const move = useMoveGlobalBoardTask(filters, {
    // A newer drag may have started; only release the one that was dropped.
    onSettled: () => setDrag((current) => (current?.dropped ? null : current)),
  });

  const queries: Record<
    GlobalBoardLane,
    ReturnType<typeof useGlobalBoardTasks>
  > = {
    "to-do": useGlobalBoardTasks("to-do", filters),
    "in-progress": useGlobalBoardTasks("in-progress", filters),
    done: useGlobalBoardTasks("done", filters),
    unmapped: useGlobalBoardTasks("unmapped", filters),
  };
  // Offset pages overlap when tasks move between page fetches; keep the first.
  const loadedTasks = (lane: GlobalBoardLane) => {
    const seen = new Set<string>();
    return (
      queries[lane].data?.pages.flatMap((page) =>
        page.tasks.filter((task) => !seen.has(task.id) && seen.add(task.id)),
      ) ?? []
    );
  };
  const shownTasks = (lane: GlobalBoardLane) =>
    laneTasksDuringDrag(lane, loadedTasks(lane), drag);

  const projects = useMemo(
    () => new Map(meta.projects.map((project) => [project.id, project])),
    [meta.projects],
  );
  const movableWorkspaces = useMemo(
    () =>
      new Set(
        meta.workspaces
          .filter((workspace) => workspace.canMoveTasks)
          .map((workspace) => workspace.id),
      ),
    [meta.workspaces],
  );
  const canMoveIn = useCallback(
    (workspaceId: string) => movableWorkspaces.has(workspaceId),
    [movableWorkspaces],
  );

  const laneName = (lane: GlobalBoardLane) =>
    t(`tasks:globalBoard.lanes.${lane}`);

  // Without a column the card only goes to the top of its own lane.
  const onMenuMove = (
    task: GlobalBoardTask,
    from: GlobalBoardLane,
    column?: ProjectColumn,
  ) => {
    if (column?.slug === task.status) return;
    const to = column ? (column.globalStatus ?? "unmapped") : from;
    move({
      task,
      from,
      to,
      index: 0,
      visibleIds: [
        task.id,
        ...loadedTasks(to)
          .filter((other) => other.id !== task.id)
          .map((other) => other.id),
      ],
      column,
    });
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 10 },
    }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as
      | { task: GlobalBoardTask; lane: GlobalBoardLane }
      | undefined;
    if (!data) return;
    setDrag({
      task: data.task,
      from: data.lane,
      lane: data.lane,
      index: loadedTasks(data.lane).findIndex(
        (task) => task.id === data.task.id,
      ),
    });
  };

  // Moves the preview into another lane as soon as the card enters it.
  const handleDragOver = ({ over }: DragOverEvent) => {
    if (!drag || drag.dropped || !over) return;
    const lane = over.data.current?.lane as GlobalBoardLane | undefined;
    if (!lane || lane === drag.lane) return;
    const allowed =
      lane === drag.from ||
      (lane !== "unmapped" && canMoveIn(drag.task.workspaceId));
    if (!allowed) return;
    const target = shownTasks(lane);
    const overIndex = target.findIndex((task) => task.id === over.id);
    setDrag({
      ...drag,
      lane,
      index: overIndex < 0 ? target.length : overIndex,
    });
  };

  const handleDragEnd = ({ over }: DragEndEvent) => {
    suppressNextClick();
    if (!drag || drag.dropped || !over) {
      setDrag(null);
      return;
    }
    const { task, from, lane } = drag;
    const list = shownTasks(lane);
    const at = list.findIndex((candidate) => candidate.id === task.id);
    // Over a card: take its place. Over the lane's empty space: go last.
    // Anywhere else (a lane it may not enter): stay where it is.
    const overId = list.some((candidate) => candidate.id === over.id)
      ? String(over.id)
      : over.id === lane
        ? null
        : task.id;
    const index = dropIndex(list, task.id, overId);
    const visibleIds = arrayMove(list, at, index).map((card) => card.id);

    const finish = (column?: ProjectColumn) => {
      const next: GlobalBoardMove = {
        task,
        from,
        to: lane,
        index,
        visibleIds,
        column,
      };
      setDrag({ ...drag, lane, index, dropped: true });
      move(next);
    };

    if (lane === from) {
      if (index === at) setDrag(null);
      else finish();
      return;
    }

    const project = projects.get(task.projectId);
    const target = resolveDropTarget(project, task.status, lane);
    if (target.kind === "move") finish(target.column);
    else if (target.kind === "unchanged") finish();
    else {
      setDrag(null);
      if (target.kind === "choose" && project)
        setChoice({
          taskTitle: task.title,
          projectName: project.name,
          laneName: laneName(lane),
          columns: target.columns,
          onChoose: (column) =>
            move({ task, from, to: lane, index, visibleIds, column }),
        });
      else
        toast.error(
          t("tasks:globalBoard.noMatchingColumn", {
            project: task.projectName,
            lane: laneName(lane),
          }),
        );
    }
  };

  const unmappedTotal =
    queries.unmapped.data?.pages.at(-1)?.pagination.total ?? 0;
  const lanes: GlobalBoardLane[] =
    unmappedTotal > 0 || drag?.from === "unmapped"
      ? [...GLOBAL_BOARD_LANES, "unmapped"]
      : [...GLOBAL_BOARD_LANES];
  const dragging = drag !== null && !drag.dropped;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      accessibility={{
        screenReaderInstructions: {
          draggable: t("tasks:globalBoard.dragInstructions"),
        },
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDrag(null);
        suppressNextClick();
      }}
    >
      <div
        className={cn(
          "min-h-0 flex-1 scroll-px-4 overflow-x-auto [-webkit-overflow-scrolling:touch]",
          // Snap whole lanes on phones; off while dragging so it doesn't fight
          // dnd-kit's auto-scroll.
          !dragging && "snap-x snap-mandatory sm:snap-none",
        )}
      >
        <div className="flex h-full min-w-max gap-4 px-4 py-3 md:px-5">
          {lanes.map((lane) => (
            <GlobalBoardLaneColumn
              key={lane}
              lane={lane}
              title={laneName(lane)}
              description={
                lane === "unmapped"
                  ? t("tasks:globalBoard.unmappedDescription")
                  : undefined
              }
              query={queries[lane]}
              tasks={shownTasks(lane)}
              projects={projects}
              canMoveIn={canMoveIn}
              onMenuMove={onMenuMove}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={reduceMotion ? null : dropAnimation}>
        {dragging ? (
          <div className="rotate-1 scale-[1.03] shadow-lg transition-[rotate,scale] duration-150 ease-out starting:rotate-0 starting:scale-100 motion-reduce:transition-none">
            <div className="rounded-lg border border-border/60 bg-card ring-2 ring-ring/35">
              <GlobalBoardCardBody task={drag.task} asLink={false} />
            </div>
          </div>
        ) : null}
      </DragOverlay>
      <ColumnChoiceDialog choice={choice} onClose={() => setChoice(null)} />
    </DndContext>
  );
}
