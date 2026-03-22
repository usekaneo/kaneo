import TaskCardContextMenuContent from "@/components/kanban-board/task-card-context-menu/task-card-context-menu-content";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { getColumnIcon } from "@/lib/column";
import type Task from "@/types/task";
import SubtaskAssigneePopover from "./subtask-assignee-popover";
import SubtaskStatusPopover from "./subtask-status-popover";

type SubtaskRowProps = {
  task: Task;
  tasks: Task[];
  projectId: string;
  workspaceId: string;
  isSelected: boolean;
  selectionRadius: string;
  assignee: {
    user?: { image?: string | null; name?: string | null } | null;
  } | null;
  onToggleSelection: () => void;
  onNavigate: () => void;
  onDeleteClick: () => void;
};

export default function SubtaskRow({
  task,
  tasks,
  projectId,
  workspaceId,
  isSelected,
  selectionRadius,
  assignee,
  onToggleSelection,
  onNavigate,
  onDeleteClick,
}: SubtaskRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`group flex items-center gap-2 py-1 px-2 ${selectionRadius} transition-colors cursor-default ${isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-accent/50"}`}
        >
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelection} />

          <SubtaskStatusPopover tasks={tasks} projectId={projectId}>
            <button
              type="button"
              className="shrink-0 flex items-center justify-center rounded p-0.5 transition-colors outline-none [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground"
            >
              {getColumnIcon(task.status, false)}
            </button>
          </SubtaskStatusPopover>

          <button
            type="button"
            className="flex-1 min-w-0 text-left outline-none"
            onClick={onNavigate}
          >
            <span
              className={`text-sm truncate block ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground/90"}`}
            >
              {task.title}
            </span>
          </button>

          <SubtaskAssigneePopover tasks={tasks} workspaceId={workspaceId}>
            <button
              type="button"
              className="shrink-0 flex items-center justify-center rounded p-0.5 transition-colors outline-none"
            >
              {task.userId && assignee ? (
                <Avatar className="h-5 w-5">
                  <AvatarImage
                    src={assignee?.user?.image ?? ""}
                    alt={assignee?.user?.name || ""}
                  />
                  <AvatarFallback className="text-[9px] font-medium border border-border/30">
                    {assignee?.user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border/70"
                  title="Unassigned"
                >
                  <span className="text-[9px] font-medium text-muted-foreground">
                    ?
                  </span>
                </div>
              )}
            </button>
          </SubtaskAssigneePopover>
        </div>
      </ContextMenuTrigger>

      <TaskCardContextMenuContent
        task={task}
        taskCardContext={{
          projectId,
          worskpaceId: workspaceId,
        }}
        onDeleteClick={onDeleteClick}
      />
    </ContextMenu>
  );
}
