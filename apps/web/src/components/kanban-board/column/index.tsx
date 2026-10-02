import { cva } from "class-variance-authority";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useBackgroundStore } from "@/store/background";
import type { ProjectWithTasks } from "@/types/project";
import { ColumnDropzone } from "./column-dropzone";
import { ColumnHeader } from "./column-header";

type ColumnProps = {
  isDragPreview?: boolean;
  column: ProjectWithTasks["columns"][number];
  activeTaskId?: string | null;
  sourceColumnId?: string;
  isPriorityOverlaySuppressed?: boolean;
  priorityOverlayColumnId?: string | null;
  disableDragDrop?: boolean;
  disableCollectionActions?: boolean;
};

export const columnVariants = cva(
  "group relative flex h-full min-h-0 w-full flex-col rounded-xl transition-colors duration-150",
  {
    defaultVariants: {
      isDropzoneOver: false,
      backgroundImage: false,
    },
    variants: {
      isDropzoneOver: {
        true: "shadow-md",
        false: "border-border/70 hover:border-border/90",
      },
      backgroundImage: {
        true: "before:content-[''] before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:pointer-events-none",
        false: "",
      },
    },
    compoundVariants: [
      {
        isDropzoneOver: false,
        backgroundImage: false,
        class: "border bg-muted/40 shadow-xs/5 dark:bg-card/90",
      },
      {
        isDropzoneOver: true,
        backgroundImage: false,
        class: "border bg-accent/60 border-ring/40 ring-2 ring-ring/30",
      },
      {
        isDropzoneOver: false,
        backgroundImage: true,
        class: "bg-background before:bg-muted before:dark:bg-card shadow-md",
      },
      {
        isDropzoneOver: true,
        backgroundImage: true,
        class: "bg-background ring-2 ring-focus/60 before:bg-accent/60",
      },
    ],
  },
);

function Column({
  column,
  isDragPreview = false,
  activeTaskId = null,
  sourceColumnId,
  isPriorityOverlaySuppressed = false,
  priorityOverlayColumnId = null,
  disableDragDrop = false,
  disableCollectionActions = false,
}: ColumnProps) {
  const [isDropzoneOver, setIsDropzoneOver] = useState(false);
  const { background } = useBackgroundStore();
  const { t } = useTranslation();
  const isActiveTaskColumn = column.id === sourceColumnId;
  const showPriorityOverlay =
    priorityOverlayColumnId === column.id &&
    activeTaskId !== null &&
    !isActiveTaskColumn &&
    !isPriorityOverlaySuppressed;

  return (
    <div
      className={columnVariants({
        isDropzoneOver,
        backgroundImage: !!background,
      })}
    >
      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <ColumnHeader
          column={column}
          disableCollectionActions={disableCollectionActions}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pt-1 pb-2 [-webkit-overflow-scrolling:touch]">
        <ColumnDropzone
          column={column}
          isDragPreview={isDragPreview}
          disableDragDrop={disableDragDrop}
          onIsOverChange={setIsDropzoneOver}
        />
      </div>
      {showPriorityOverlay && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/85 px-4 text-center">
          <span className="text-sm font-medium text-neutral-950">
            {t("tasks:kanban.priorityOrderedOverlayHint")}
          </span>
        </div>
      )}
    </div>
  );
}

export default Column;
