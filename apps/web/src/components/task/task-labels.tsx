import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useAssignLabelToTask from "@/hooks/mutations/label/use-assign-label-to-task";
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useUnassignLabelFromTask from "@/hooks/mutations/label/use-unassign-label-from-task";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const labelColors = [
  { value: "gray", label: "Gray", color: "#94a3b8" },
  { value: "blue", label: "Blue", color: "#3b82f6" },
  { value: "purple", label: "Purple", color: "#a855f7" },
  { value: "teal", label: "Teal", color: "#14b8a6" },
  { value: "green", label: "Green", color: "#22c55e" },
  { value: "yellow", label: "Yellow", color: "#eab308" },
  { value: "orange", label: "Orange", color: "#f97316" },
  { value: "pink", label: "Pink", color: "#ec4899" },
  { value: "red", label: "Red", color: "#ef4444" },
];

type LabelColor =
  | "gray"
  | "blue"
  | "purple"
  | "teal"
  | "green"
  | "yellow"
  | "orange"
  | "pink"
  | "red";

type TaskLabel = {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
  createdAt: string;
};

interface TaskLabelsProps {
  taskId: string;
  setIsSaving: (isSaving: boolean) => void;
}

function TaskLabels({ taskId, setIsSaving }: TaskLabelsProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceStore();
  const { project } = useProjectStore();

  const { mutateAsync: createLabel } = useCreateLabel();
  const { mutateAsync: assignLabel } = useAssignLabelToTask();
  const { mutateAsync: unassignLabel } = useUnassignLabelFromTask();

  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(
    workspace?.id ?? "",
  );
  const { data: taskLabels = [] } = useGetLabelsByTask(taskId);

  const assignedLabelIds = new Set(
    taskLabels.map((label: TaskLabel) => label.id),
  );

  const filteredLabels = workspaceLabels.filter((label: TaskLabel) =>
    label.name.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const isCreatingNewLabel =
    searchValue.trim() &&
    !workspaceLabels.some(
      (label: TaskLabel) =>
        label.name.toLowerCase() === searchValue.trim().toLowerCase(),
    );

  const handleToggleLabel = async (label: TaskLabel) => {
    setIsSaving(true);
    try {
      if (assignedLabelIds.has(label.id)) {
        await unassignLabel({ taskId, labelId: label.id });
        toast.success("Label removed");
      } else {
        await assignLabel({ taskId, labelId: label.id });
        toast.success("Label added");
      }

      await queryClient.invalidateQueries({ queryKey: ["labels", taskId] });
      await queryClient.invalidateQueries({
        queryKey: ["labels", "workspace", workspace?.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      if (project?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["tasks", project.id],
        });
      }

      await queryClient.refetchQueries({ queryKey: ["labels", taskId] });
      await queryClient.refetchQueries({
        queryKey: ["labels", "workspace", workspace?.id],
      });
      await queryClient.refetchQueries({ queryKey: ["task", taskId] });
      if (project?.id) {
        await queryClient.refetchQueries({ queryKey: ["tasks", project.id] });
      }
    } catch (error) {
      toast.error("Failed to update label");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateLabelWithColor = async (color: LabelColor) => {
    if (!searchValue.trim() || !workspace?.id) return;

    setIsSaving(true);
    try {
      const newLabel = await createLabel({
        name: searchValue.trim(),
        color: color,
        workspaceId: workspace.id,
      });

      if (newLabel?.id) {
        await assignLabel({ taskId, labelId: newLabel.id });
      }

      await queryClient.invalidateQueries({ queryKey: ["labels", taskId] });
      await queryClient.invalidateQueries({
        queryKey: ["labels", "workspace", workspace.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      if (project?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["tasks", project.id],
        });
      }

      await queryClient.refetchQueries({ queryKey: ["labels", taskId] });
      await queryClient.refetchQueries({
        queryKey: ["labels", "workspace", workspace.id],
      });
      await queryClient.refetchQueries({ queryKey: ["task", taskId] });
      if (project?.id) {
        await queryClient.refetchQueries({ queryKey: ["tasks", project.id] });
      }

      toast.success("Label created and assigned");
      setSearchValue("");
      setColorPickerOpen(false);
      setOpen(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create label";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLabel = async (labelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);
    try {
      await unassignLabel({ taskId, labelId });

      await queryClient.invalidateQueries({ queryKey: ["labels", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      if (project?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["tasks", project.id],
        });
      }

      await queryClient.refetchQueries({ queryKey: ["labels", taskId] });
      await queryClient.refetchQueries({ queryKey: ["task", taskId] });
      if (project?.id) {
        await queryClient.refetchQueries({ queryKey: ["tasks", project.id] });
      }

      toast.success("Label removed");
    } catch (error) {
      toast.error("Failed to remove label");
    } finally {
      setIsSaving(false);
    }
  };

  const getColorValue = (colorKey: string) => {
    return labelColors.find((c) => c.value === colorKey)?.color || "#94a3b8";
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Labels
      </Label>

      <div className="space-y-2">
        {taskLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {taskLabels.map((label: TaskLabel) => (
              <Badge
                key={label.id}
                variant="outline"
                className="flex items-center gap-1.5 pl-2 pr-1 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getColorValue(label.color) }}
                />
                <span className="text-sm">{label.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveLabel(label.id, e)}
                  className="ml-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Plus className="w-4 h-4 mr-1" />
              Add Label
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="flex items-center p-2 border-b border-zinc-200 dark:border-zinc-800">
              <Search className="w-4 h-4 text-zinc-500 mr-2" />
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search or create label..."
                className="border-0 h-8 text-sm focus-visible:ring-0 shadow-none"
              />
            </div>

            <div className="max-h-64 overflow-y-auto">
              {filteredLabels.length > 0 && (
                <div className="p-1">
                  {filteredLabels.map((label: TaskLabel) => {
                    const isAssigned = assignedLabelIds.has(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => handleToggleLabel(label)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                      >
                        <div className="w-4 text-center">
                          {isAssigned && (
                            <Check className="w-4 h-4 text-zinc-600" />
                          )}
                        </div>
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: getColorValue(label.color),
                          }}
                        />
                        <span className="text-zinc-900 dark:text-zinc-200">
                          {label.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {isCreatingNewLabel && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 p-1">
                  <Popover
                    open={colorPickerOpen}
                    onOpenChange={setColorPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                      >
                        <div className="w-4 text-center">
                          <Plus className="w-4 h-4 text-zinc-500" />
                        </div>
                        <span className="w-3 h-3 rounded-full bg-zinc-400" />
                        <span className="text-zinc-900 dark:text-zinc-200">
                          Create "{searchValue}"
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-64 p-0"
                      align="start"
                      side="right"
                    >
                      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
                        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                          Pick a color for label
                        </h4>
                      </div>
                      <div className="p-1">
                        {labelColors.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() =>
                              handleCreateLabelWithColor(
                                color.value as LabelColor,
                              )
                            }
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                          >
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: color.color }}
                            />
                            <span className="text-zinc-900 dark:text-zinc-200">
                              {color.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {!isCreatingNewLabel &&
                filteredLabels.length === 0 &&
                searchValue && (
                  <div className="p-6 text-center text-sm text-zinc-500">
                    No labels found
                  </div>
                )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export default TaskLabels;
