import { ArrowUpToLine, Clock, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";

type ProjectColumn = GlobalBoardProject["columns"][number];

type TaskMoveMenuProps = {
  task: GlobalBoardTask;
  columns: ProjectColumn[];
  onMove: (column: ProjectColumn) => void;
  onMoveToTop?: () => void;
  onMoveToBacklog?: () => void;
  className?: string;
};

// Moving without dragging, for keyboards and small touch screens. It lists the
// task's own project columns, so the exact destination is always explicit.
export function TaskMoveMenu({
  task,
  columns,
  onMove,
  onMoveToTop,
  onMoveToBacklog,
  className,
}: TaskMoveMenuProps) {
  const { t } = useTranslation();
  const label = t("tasks:globalBoard.moveTask", { title: task.title });

  return (
    <Menu>
      <MenuTrigger
        aria-label={label}
        title={label}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        className={cn(
          "flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          "md:opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100 data-popup-open:opacity-100",
          className,
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuItem disabled={!onMoveToTop} onClick={onMoveToTop}>
          <ArrowUpToLine />
          <span>{t("tasks:globalBoard.moveToTop")}</span>
        </MenuItem>
        {columns.length > 0 && (
          <>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>
                {t("tasks:globalBoard.moveTo", { project: task.projectName })}
              </MenuGroupLabel>
              {columns.map((column) => (
                <MenuItem
                  key={`${column.slug}-${column.position}`}
                  disabled={column.slug === task.status}
                  onClick={() => onMove(column)}
                >
                  {getColumnIcon(column.slug, column.isFinal, column.icon)}
                  <span className="truncate">{column.name}</span>
                </MenuItem>
              ))}
            </MenuGroup>
          </>
        )}
        {onMoveToBacklog && (
          <>
            <MenuSeparator />
            <MenuItem onClick={onMoveToBacklog}>
              <Clock />
              <span>{t("tasks:actions.moveToBacklog")}</span>
            </MenuItem>
          </>
        )}
      </MenuPopup>
    </Menu>
  );
}
