import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import TaskCardContextMenuContent from "@/components/kanban-board/task-card-context-menu/task-card-context-menu-content";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { EASE_OUT } from "@/lib/motion";
import type Task from "@/types/task";
import { ReferenceAssigneeButton } from "./sections/reference-assignee-button";
import { ReferenceStatusButton } from "./sections/reference-status-button";
import { TaskReferenceRow } from "./sections/task-reference-row";

type SubtaskRowProps = {
  task: Task;
  tasks: Task[];
  displayId: string | null;
  projectId: string;
  workspaceId: string;
  workspaceSlug?: string | null;
  isSelected: boolean;
  isFocused: boolean;
  isCompleted: boolean;
  canEdit: boolean;
  selectionRadius: string;
  assignee: {
    user?: { image?: string | null; name?: string | null } | null;
  } | null;
  onToggleComplete: () => void;
  onNavigate: () => void;
  onDeleteClick: () => void;
};

export default function SubtaskRow({
  task,
  tasks,
  displayId,
  projectId,
  workspaceId,
  workspaceSlug,
  isSelected,
  isFocused,
  isCompleted,
  canEdit,
  selectionRadius,
  assignee,
  onToggleComplete,
  onNavigate,
  onDeleteClick,
}: SubtaskRowProps) {
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <TaskReferenceRow
            className={cn(
              selectionRadius,
              isSelected && "bg-primary/10 hover:bg-primary/15",
              isFocused && !isSelected && "bg-accent",
            )}
            status={
              <ReferenceStatusButton
                aria-pressed={isCompleted}
                aria-label={t("tasks:subtasks.completeAria")}
                disabled={!canEdit}
                onClick={onToggleComplete}
              >
                {getColumnIcon(task.status, isCompleted)}
              </ReferenceStatusButton>
            }
            displayId={displayId}
            title={task.title}
            done={isCompleted}
            onOpen={onNavigate}
            assignee={
              <ReferenceAssigneeButton
                tasks={tasks}
                workspaceId={workspaceId}
                name={assignee?.user?.name ?? task.assigneeName}
                image={assignee?.user?.image}
              />
            }
          />
        </ContextMenuTrigger>

        <TaskCardContextMenuContent
          task={task}
          taskCardContext={{
            projectId,
            worskpaceId: workspaceId,
            workspaceSlug,
          }}
          onDeleteClick={onDeleteClick}
        />
      </ContextMenu>
    </motion.div>
  );
}
