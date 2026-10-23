import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  GlobalBoardMeta,
  GlobalBoardProject,
} from "@/fetchers/task/get-global-board-meta";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import { useMoveGlobalBoardTask } from "@/hooks/mutations/task/use-move-global-board-task";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { type ColumnChoice, ColumnChoiceDialog } from "./column-choice-dialog";
import GlobalBoardCard from "./global-board-card";
import {
  GLOBAL_BOARD_LANES,
  type GlobalBoardFilters,
  type GlobalBoardLane,
} from "./global-board-filters";
import { GlobalBoardLaneColumn } from "./global-board-lane";
import { resolveDropTarget } from "./resolve-drop-target";
import { suppressNextClick } from "./suppress-next-click";

type ProjectColumn = GlobalBoardProject["columns"][number];

type ActiveDrag = { task: GlobalBoardTask; lane: GlobalBoardLane };

export function GlobalBoard({
  meta,
  filters,
}: {
  meta: GlobalBoardMeta;
  filters: GlobalBoardFilters;
}) {
  const { t } = useTranslation();
  const { mutate: moveTask } = useMoveGlobalBoardTask(filters);
  const [active, setActive] = useState<ActiveDrag | null>(null);
  const [choice, setChoice] = useState<ColumnChoice | null>(null);

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

  const commit = (
    task: GlobalBoardTask,
    from: GlobalBoardLane,
    column: ProjectColumn,
  ) => {
    if (column.slug === task.status) return;
    moveTask({ task, from, to: column.globalStatus ?? "unmapped", column });
  };

  const dropOnLane = (
    task: GlobalBoardTask,
    from: GlobalBoardLane,
    to: GlobalBoardLane,
  ) => {
    const project = projects.get(task.projectId);
    const target = resolveDropTarget(project, task.status, to);
    if (target.kind === "move") commit(task, from, target.column);
    else if (target.kind === "choose" && project)
      setChoice({
        taskTitle: task.title,
        projectName: project.name,
        laneName: laneName(to),
        columns: target.columns,
        onChoose: (column) => commit(task, from, column),
      });
    else if (target.kind === "unavailable")
      toast.error(
        t("tasks:globalBoard.noMatchingColumn", {
          project: task.projectName,
          lane: laneName(to),
        }),
      );
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 10 },
    }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as ActiveDrag | undefined;
    setActive(data ? { task: data.task, lane: data.lane } : null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    suppressNextClick();
    const data = active.data.current as ActiveDrag | undefined;
    const to = over?.data.current?.lane as GlobalBoardLane | undefined;
    if (data && to && to !== data.lane) dropOnLane(data.task, data.lane, to);
  };

  const laneProps = { filters, projects, canMoveIn, onMove: commit };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      accessibility={{
        screenReaderInstructions: {
          draggable: t("tasks:globalBoard.dragInstructions"),
        },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActive(null);
        suppressNextClick();
      }}
    >
      <div
        className={cn(
          "min-h-0 flex-1 scroll-px-4 overflow-x-auto [-webkit-overflow-scrolling:touch]",
          // Snap whole lanes on phones; off while dragging so it doesn't fight
          // dnd-kit's auto-scroll.
          active === null && "snap-x snap-mandatory sm:snap-none",
        )}
      >
        <div className="flex h-full min-w-max gap-4 px-4 py-3 md:px-5">
          {GLOBAL_BOARD_LANES.map((lane) => (
            <GlobalBoardLaneColumn
              key={lane}
              lane={lane}
              title={laneName(lane)}
              {...laneProps}
            />
          ))}
          <GlobalBoardLaneColumn
            lane="unmapped"
            title={laneName("unmapped")}
            description={t("tasks:globalBoard.unmappedDescription")}
            hideWhenEmpty
            {...laneProps}
          />
        </div>
      </div>
      <DragOverlay>
        {active ? (
          <div className="rotate-1 shadow-lg ring-2 ring-ring/35 rounded-lg">
            <GlobalBoardCard
              task={active.task}
              lane={active.lane}
              canMove
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
      <ColumnChoiceDialog choice={choice} onClose={() => setChoice(null)} />
    </DndContext>
  );
}
