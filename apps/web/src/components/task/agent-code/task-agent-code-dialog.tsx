import { Dialog, DialogPopup } from "@/components/ui/dialog";
import useGetTask from "@/hooks/queries/task/use-get-task";
import type { AgentCodeRepository } from "@/types/agent";
import { TaskAgentCodeForm } from "./task-agent-code-form";

type TaskAgentCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  taskId: string;
  repositories: AgentCodeRepository[];
};

export function TaskAgentCodeDialog({
  open,
  onOpenChange,
  workspaceId,
  taskId,
  repositories,
}: TaskAgentCodeDialogProps) {
  const { data: task } = useGetTask(taskId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        {task && (
          <TaskAgentCodeForm
            workspaceId={workspaceId}
            task={task}
            repositories={repositories}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}
