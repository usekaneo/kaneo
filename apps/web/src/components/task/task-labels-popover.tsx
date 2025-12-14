import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useDeleteLabel from "@/hooks/mutations/label/use-delete-label";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";

const labelColors = [
  { value: "gray", label: "Stone", color: "#78716c" },
  { value: "dark-gray", label: "Slate", color: "#64748b" },
  { value: "purple", label: "Lavender", color: "#8b5cf6" },
  { value: "teal", label: "Sage", color: "#059669" },
  { value: "green", label: "Forest", color: "#16a34a" },
  { value: "yellow", label: "Amber", color: "#d97706" },
  { value: "orange", label: "Terracotta", color: "#ea580c" },
  { value: "pink", label: "Rose", color: "#e11d48" },
  { value: "red", label: "Crimson", color: "#dc2626" },
];

type LabelColor =
  | "gray"
  | "dark-gray"
  | "purple"
  | "teal"
  | "green"
  | "yellow"
  | "orange"
  | "pink"
  | "red";

type TaskLabelsPopoverProps = {
  task: Task;
  workspaceId: string;
  children: React.ReactNode;
};

type PopoverStep = "select" | "color";

export default function TaskLabelsPopover({
  task,
  workspaceId,
  children,
}: TaskLabelsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PopoverStep>("select");
  const [searchValue, setSearchValue] = useState("");
  const [selectedColor, setSelectedColor] = useState<LabelColor>("gray");
  const [newLabelName, setNewLabelName] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { mutateAsync: createLabel } = useCreateLabel();
  const { mutateAsync: deleteLabel } = useDeleteLabel();

  const { data: taskLabels = [] } = useGetLabelsByTask(task.id);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);

  const taskLabelNames = useMemo(
    () => taskLabels.map((label) => label.name),
    [taskLabels],
  );

  const filteredLabels = useMemo(() => {
    const searchFiltered = workspaceLabels.filter((label) =>
      label.name.toLowerCase().includes(searchValue.toLowerCase()),
    );

    const labelMap = new Map<string, (typeof workspaceLabels)[0]>();
    for (const label of searchFiltered) {
      const existing = labelMap.get(label.name);
      if (!existing || (label.taskId === null && existing.taskId !== null)) {
        labelMap.set(label.name, label);
      }
    }

    return Array.from(labelMap.values());
  }, [workspaceLabels, searchValue]);

  const isCreatingNewLabel = useMemo(
    () =>
      searchValue &&
      !workspaceLabels.some(
        (label) => label.name.toLowerCase() === searchValue.toLowerCase(),
      ),
    [workspaceLabels, searchValue],
  );

  useEffect(() => {
    if (open && step === "select" && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open, step]);

  const resetPopover = () => {
    setStep("select");
    setSearchValue("");
    setNewLabelName("");
    setSelectedColor("gray");
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(resetPopover, 200);
  };

  const handleToggleLabel = async (labelId: string) => {
    try {
      const workspaceLabel = workspaceLabels.find((l) => l.id === labelId);
      if (!workspaceLabel) return;

      const isCurrentlyAssigned = taskLabelNames.includes(workspaceLabel.name);

      if (isCurrentlyAssigned) {
        // Remove label from task - find by name since IDs are different
        const taskLabel = taskLabels.find(
          (l) => l.name === workspaceLabel.name,
        );
        if (taskLabel?.id) {
          await deleteLabel({ id: taskLabel.id });
          toast.success("Label removed");
        }
      } else {
        // Add label to task
        await createLabel({
          name: workspaceLabel.name,
          color: workspaceLabel.color as LabelColor,
          taskId: task.id,
          workspaceId,
        });
        toast.success("Label added");
      }

      // Invalidate all relevant queries
      await queryClient.invalidateQueries({
        queryKey: ["labels", task.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["labels", workspaceId],
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update label",
      );
    }
  };

  const handleCreateNewClick = () => {
    setNewLabelName(searchValue);
    setStep("color");
  };

  const handleColorSelect = async (color: LabelColor) => {
    setSelectedColor(color);

    // Create the label immediately
    if (!newLabelName.trim()) return;

    try {
      // First create the label in the workspace
      await createLabel({
        name: newLabelName.trim(),
        color: color,
        workspaceId,
      });

      // Then assign it to the task
      await createLabel({
        name: newLabelName.trim(),
        color: color,
        taskId: task.id,
        workspaceId,
      });

      // Invalidate all relevant queries
      await queryClient.invalidateQueries({
        queryKey: ["labels", task.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["labels", workspaceId],
      });

      toast.success("Label created and added");
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create label",
      );
    }
  };

  const renderSelectStep = () => (
    <div className="w-auto">
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <Search className="w-3 h-3 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search labels..."
          className="border-none p-0 h-auto focus-visible:ring-0 shadow-none !bg-transparent"
        />
      </div>

      <div className="py-1">
        {filteredLabels.length === 0 && searchValue.length === 0 && (
          <span className="text-xs text-muted-foreground px-2">
            No labels found
          </span>
        )}
        {filteredLabels.map((label) => (
          <button
            key={label.id}
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent/50 text-left"
            onClick={() => handleToggleLabel(label.id)}
          >
            <div className="flex-shrink-0 w-3 flex justify-center">
              {taskLabelNames.includes(label.name) && (
                <Check className="w-3 h-3" />
              )}
            </div>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor:
                  labelColors.find((c) => c.value === label.color)?.color ||
                  "#94a3b8",
              }}
            />
            <span className="truncate">{label.name}</span>
          </button>
        ))}

        {isCreatingNewLabel && filteredLabels.length > 0 && (
          <div className="border-t border-border my-1" />
        )}
        {isCreatingNewLabel && (
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent/50 text-left"
            onClick={handleCreateNewClick}
          >
            <div className="flex-shrink-0 w-3 flex justify-center">
              <Plus className="w-3 h-3" />
            </div>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor:
                  labelColors.find((c) => c.value === selectedColor)?.color ||
                  "#94a3b8",
              }}
            />
            <span className="truncate">Create "{searchValue}"</span>
          </button>
        )}
      </div>
    </div>
  );

  const renderColorStep = () => (
    <div className="w-auto">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <span className="text-xs font-medium">Choose color</span>
        <button
          type="button"
          onClick={() => setStep("select")}
          className="w-4 h-4 flex items-center justify-center hover:bg-accent/50 rounded"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="py-1">
        {labelColors.map((color) => (
          <button
            key={color.value}
            type="button"
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent/50 text-left",
              selectedColor === color.value && "bg-accent/30",
            )}
            onClick={() => handleColorSelect(color.value as LabelColor)}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color.color }}
            />
            <span className="truncate">{color.label}</span>
            {selectedColor === color.value && (
              <Check className="w-3 h-3 ml-auto" />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        {step === "select" && renderSelectStep()}
        {step === "color" && renderColorStep()}
      </PopoverContent>
    </Popover>
  );
}
