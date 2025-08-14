import { Button } from "@/components/ui/button";
import { FormItem, FormLabel } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useCreateTaskLink from "@/hooks/mutations/task-link/use-create-task-link";
import useDeleteTaskLink from "@/hooks/mutations/task-link/use-delete-task-link";
import useGetTaskLinks from "@/hooks/queries/task-link/use-get-task-links";
import { generateLink } from "@/lib/generate-link";
import useProjectStore from "@/store/project";
import type { TaskLink, TaskLinkType } from "@/types/task-link";
import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TaskLinkPanelProps {
  taskId: string;
}

export default function TaskLinkPanel({ taskId }: TaskLinkPanelProps) {
  const { project } = useProjectStore();
  const { data: links = [] } = useGetTaskLinks(taskId);
  const { mutateAsync: createLink } = useCreateTaskLink();
  const { mutateAsync: deleteLink } = useDeleteTaskLink();
  const [targetTask, setTargetTask] = useState("");
  const [linkType, setLinkType] = useState<TaskLinkType>("relates_to");

  const tasks = project?.columns?.flatMap((col) => col.tasks) ?? [];
  const options = tasks.filter((t) => t.id !== taskId);

  const handleAddLink = async () => {
    if (!targetTask) return;
    try {
      await createLink({
        taskId,
        targetTaskId: targetTask,
        type: linkType,
      });
      setTargetTask("");
      setLinkType("relates_to");
      toast.success("Task linked");
    } catch (error) {
      toast.error("Failed to link task");
    }
  };

  const handleCopy = (id: string) => {
    if (!project) return;
    const path = `/dashboard/workspace/${project.workspaceId}/project/${project.id}/task/${id}`;
    const link = generateLink(path);
    navigator.clipboard.writeText(link);
    toast.success("Task link copied!");
  };

  const handleDelete = async (linkId: string) => {
    try {
      await deleteLink({ taskId, linkId });
      toast.success("Link removed");
    } catch (error) {
      toast.error("Failed to remove link");
    }
  };

  const getLinkedTask = (link: TaskLink) => {
    const otherId =
      link.fromTaskId === taskId ? link.toTaskId : link.fromTaskId;
    return tasks.find((t) => t.id === otherId);
  };

  return (
    <FormItem className="mt-4">
      <FormLabel>Linked Tasks</FormLabel>
      <div className="space-y-2">
        {links.map((link: TaskLink) => {
          const task = getLinkedTask(link);
          if (!task) return null;
          return (
            <div
              key={link.id}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {task.title} ({link.type.replace(/_/g, " ")})
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(task.id)}
                  aria-label="Copy task link"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(link.id)}
                  aria-label="Remove link"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-2">
          <Select
            value={linkType}
            onValueChange={(v: TaskLinkType) => setLinkType(v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "blocks",
                  "blocked_by",
                  "relates_to",
                  "duplicates",
                  "parent",
                  "child",
                ] as TaskLinkType[]
              ).map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={targetTask} onValueChange={setTargetTask}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select task" />
            </SelectTrigger>
            <SelectContent>
              {options.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddLink} disabled={!targetTask}>
            Add
          </Button>
        </div>
      </div>
    </FormItem>
  );
}
