import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";

type TaskCrumbSelectProps = {
  projectId: string;
  taskId: string;
  taskLabel?: string;
  onSelectTask: (taskId: string) => void;
};

export default function TaskCrumbSelect({
  projectId,
  taskId,
  taskLabel,
  onSelectTask,
}: TaskCrumbSelectProps) {
  const { data: project } = useGetTasks(projectId);
  const tasks = [
    ...(project?.columns?.flatMap((column) => column.tasks) ?? []),
    ...(project?.plannedTasks ?? []),
    ...(project?.archivedTasks ?? []),
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="h-7 max-w-56 justify-between gap-1.5 px-2 text-xs text-foreground"
          />
        }
      >
        <span className="truncate text-left">{taskLabel || "Select task"}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
            Tasks
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <DropdownMenuItem
                key={task.id}
                disabled={task.id === taskId}
                onClick={() => onSelectTask(task.id)}
                className="h-8 gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-foreground">
                  {task.number != null ? `#${task.number} ` : ""}
                  {task.title}
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem
              disabled
              className="h-8 text-sm text-muted-foreground"
            >
              No tasks
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
