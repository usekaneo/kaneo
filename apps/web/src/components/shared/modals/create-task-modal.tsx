import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetActiveWorkspaceUsers from "@/hooks/queries/workspace-users/use-active-workspace-users";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import { format } from "date-fns";
import { produce } from "immer";
import {
  CalendarIcon,
  Check,
  Flag,
  PlusIcon,
  Search,
  Tag,
  Target,
  UserIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  status?: string;
}

type Priority = "low" | "medium" | "high" | "urgent";

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

type Label = {
  name: string;
  color: LabelColor;
};

const labelColors = [
  { value: "gray" as LabelColor, label: "Grey", color: "#94a3b8" },
  { value: "dark-gray" as LabelColor, label: "Dark Grey", color: "#64748b" },
  { value: "purple" as LabelColor, label: "Purple", color: "#a855f7" },
  { value: "teal" as LabelColor, label: "Teal", color: "#14b8a6" },
  { value: "green" as LabelColor, label: "Green", color: "#22c55e" },
  { value: "yellow" as LabelColor, label: "Yellow", color: "#eab308" },
  { value: "orange" as LabelColor, label: "Orange", color: "#f97316" },
  { value: "pink" as LabelColor, label: "Pink", color: "#ec4899" },
  { value: "red" as LabelColor, label: "Red", color: "#ef4444" },
];

function CreateTaskModal({ open, onClose, status }: CreateTaskModalProps) {
  const { project, setProject } = useProjectStore();
  const { workspace } = useWorkspaceStore();
  const { mutate: updateTask } = useUpdateTask();
  const { mutateAsync: createLabel } = useCreateLabel();
  const { data: users } = useGetActiveWorkspaceUsers({
    workspaceId: workspace?.id ?? "",
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("low");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [createMore, setCreateMore] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);

  const [labelsOpen, setLabelsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [selectedColor, setSelectedColor] = useState<LabelColor>("gray");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync } = useCreateTask();

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setPriority("low");
    setAssigneeId("");
    setDueDate(undefined);
    setCreateMore(false);
    setLabels([]);
    setSearchValue("");
    setSelectedColor("gray");
    setColorPickerOpen(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !project?.id || !workspace?.id) return;

    try {
      const taskStatus = status ?? "to-do";

      const newTask = await mutateAsync({
        title: title.trim(),
        description: description.trim() || "",
        userId: assigneeId,
        priority,
        projectId: project?.id,
        dueDate: dueDate ? dueDate.toISOString() : new Date().toISOString(),
        status: taskStatus,
      });

      for (const label of labels) {
        try {
          await createLabel({
            name: label.name,
            color: label.color,
            taskId: newTask.id,
          });
        } catch (error) {
          console.error("Failed to create label:", error);
        }
      }

      const updatedProject = produce(project, (draft) => {
        if (newTask.status !== "planned" && newTask.status !== "archived") {
          const targetColumn = draft.columns?.find(
            (col) => col.id === newTask.status,
          );
          if (targetColumn) {
            targetColumn.tasks.push({
              ...newTask,
              assigneeId: assigneeId,
              assigneeName: assigneeId,
              position: 0,
            });
          }
        }
      });

      setProject(updatedProject);
      updateTask({ ...newTask, position: 0, assigneeId: assigneeId });
      toast.success("Task created successfully");

      if (createMore) {
        setTitle("");
        setDescription("");
        setPriority("low");
        setAssigneeId("");
        setDueDate(undefined);
        setLabels([]);
        setSearchValue("");
        setSelectedColor("gray");
        setColorPickerOpen(false);
      } else {
        handleClose();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create task",
      );
    }
  };

  const priorityOptions = [
    {
      value: "low",
      label: "Low",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      value: "medium",
      label: "Medium",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      value: "high",
      label: "High",
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    },
    {
      value: "urgent",
      label: "Urgent",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
  ];

  const selectedPriority = priorityOptions.find((p) => p.value === priority);
  const selectedUser = users?.find((u) => u.userId === assigneeId);

  const filteredLabels = labels.filter((label: Label) =>
    label.name.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const isCreatingNewLabel =
    searchValue &&
    !labels.some(
      (label: Label) => label.name.toLowerCase() === searchValue.toLowerCase(),
    );

  useEffect(() => {
    if (labelsOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [labelsOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isCreatingNewLabel) {
      e.preventDefault();
      handleCreateLabel();
    } else if (e.key === "Escape") {
      if (searchValue) {
        setSearchValue("");
      } else {
        setLabelsOpen(false);
      }
    }
  };

  const toggleLabel = (labelName: string) => {
    const existingLabel = labels.find((l) => l.name === labelName);
    if (existingLabel) {
      setLabels(labels.filter((l) => l.name !== labelName));
    } else {
      const labelToAdd = labels.find((l) => l.name === labelName);
      if (labelToAdd) {
        setLabels([...labels.filter((l) => l.name !== labelName), labelToAdd]);
      }
    }
  };

  const handleCreateLabel = () => {
    if (!searchValue.trim()) return;

    const labelExists = labels.some(
      (label) => label.name.toLowerCase() === searchValue.trim().toLowerCase(),
    );

    if (labelExists) {
      toast.error("Label already exists");
      return;
    }

    setLabels([...labels, { name: searchValue.trim(), color: selectedColor }]);
    setSearchValue("");
    setSelectedColor("gray");
    searchInputRef.current?.focus();
  };

  const removeLabel = (labelName: string) => {
    setLabels(labels.filter((l) => l.name !== labelName));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle asChild>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="text-zinc-600 dark:text-zinc-400 font-semibold tracking-wider text-sm">
                  {project?.slug?.toUpperCase() || "TASK"}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="text-zinc-700 dark:text-zinc-300 font-medium text-sm">
                  New Task
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a new task by providing a title, description, and other
            details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-6 px-6">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Task title"
              className="!text-2xl font-semibold !border-0 px-0 py-3 !shadow-none focus-visible:!ring-0 !bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 tracking-tight focus:!outline-none focus-visible:!outline-none"
              required
            />

            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description..."
              className="!border-0 px-0 py-2 !shadow-none focus-visible:!ring-0 !bg-transparent text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 resize-none min-h-[120px] focus:!outline-none focus-visible:!outline-none"
            />

            {labels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <Badge
                    key={label.name}
                    badgeColor={label.color}
                    variant="outline"
                    className="flex items-center gap-1 pl-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => removeLabel(label.name)}
                  >
                    <span
                      className="inline-block w-2 h-2 mr-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          labelColors.find((c) => c.value === label.color)
                            ?.color || "#94a3b8",
                      }}
                    />
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 py-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-500/20 dark:to-yellow-500/20 text-amber-800 dark:text-amber-300 rounded-md text-xs font-medium border border-amber-300 dark:border-amber-500/30">
                <div className="w-1.5 h-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 dark:from-amber-400 dark:to-yellow-400 rounded-full shadow-sm" />
                {status
                  ? status.charAt(0).toUpperCase() +
                    status.slice(1).replace("-", " ")
                  : "In Progress"}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 hover:scale-105 border",
                      selectedPriority && priority !== "low"
                        ? `${selectedPriority.color} ${selectedPriority.bg} ${selectedPriority.border}`
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700/50",
                    )}
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>
                      {selectedPriority ? selectedPriority.label : "Priority"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="space-y-1">
                    {priorityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-200 hover:scale-[1.02]",
                          option.color,
                          option.bg,
                          `hover:${option.bg}`,
                        )}
                        onClick={() => setPriority(option.value as Priority)}
                      >
                        <Flag className={cn("w-3.5 h-3.5", option.color)} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 hover:scale-105 border",
                      selectedUser
                        ? "text-indigo-300 bg-indigo-500/10 border-indigo-500/30"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700/50",
                    )}
                  >
                    {selectedUser ? (
                      <>
                        <div className="w-4 h-4 bg-zinc-400 dark:bg-zinc-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                          {selectedUser.userName?.charAt(0).toUpperCase() ||
                            "?"}
                        </div>
                        <span>{selectedUser.userName}</span>
                      </>
                    ) : (
                      <>
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>Assign</span>
                      </>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-1">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-900 dark:text-zinc-300 transition-all duration-200 hover:scale-[1.02]"
                      onClick={() => setAssigneeId("")}
                    >
                      <UserIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-500" />
                      Unassigned
                    </button>
                    {users?.map((user) => (
                      <button
                        key={user.userId}
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-900 dark:text-zinc-300 transition-all duration-200 hover:scale-[1.02]"
                        onClick={() => setAssigneeId(user.userId || "")}
                      >
                        <div className="w-4 h-4 bg-zinc-400 dark:bg-zinc-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                          {user.userName?.charAt(0).toUpperCase() || "?"}
                        </div>
                        {user.userName}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 hover:scale-105 border",
                      dueDate
                        ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700/50",
                    )}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>
                      {dueDate ? format(dueDate, "MMM d, yyyy") : "Due date"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    className="rounded-md border-0"
                  />
                  {dueDate && (
                    <div className="flex justify-between items-center pt-3 border-t border-zinc-200 dark:border-zinc-800/50 mt-3">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {format(dueDate, "EEEE, MMMM d, yyyy")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDueDate(undefined)}
                        className="text-xs text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 hover:scale-105 border",
                      labels.length > 0
                        ? "text-violet-300 bg-violet-500/10 border-violet-500/30"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700/50",
                    )}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Labels</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-0 overflow-hidden"
                  align="start"
                  sideOffset={5}
                >
                  <div className="flex items-center p-2 border-b border-zinc-200 dark:border-zinc-800">
                    <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400 mr-2" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Change or add labels..."
                      className="w-full bg-transparent border-none text-zinc-900 dark:text-zinc-200 text-sm focus:outline-none placeholder:text-zinc-500"
                    />
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {filteredLabels.length > 0 ? (
                      <div className="py-1">
                        {filteredLabels.map((label: Label) => (
                          <button
                            key={label.name}
                            type="button"
                            className="w-full flex items-center px-3 py-2 text-sm text-left text-zinc-900 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            onClick={() => toggleLabel(label.name)}
                          >
                            <div className="flex-shrink-0 w-4 mr-2 text-center">
                              <Check className="w-4 h-4 text-zinc-400" />
                            </div>
                            <span
                              className="w-3 h-3 rounded-full mr-2"
                              style={{
                                backgroundColor:
                                  labelColors.find(
                                    (c) => c.value === label.color,
                                  )?.color || "#94a3b8",
                              }}
                            />
                            <span>{label.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {isCreatingNewLabel && (
                      <div className="py-1 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                          type="button"
                          className="w-full flex items-center px-3 py-2 text-sm text-left text-zinc-900 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={handleCreateLabel}
                        >
                          <div className="flex-shrink-0 w-4 mr-2 text-center">
                            <PlusIcon className="w-4 h-4 text-zinc-400" />
                          </div>
                          <span
                            className="w-3 h-3 rounded-full mr-2"
                            style={{
                              backgroundColor:
                                labelColors.find(
                                  (c) => c.value === selectedColor,
                                )?.color || "#94a3b8",
                            }}
                          />
                          <span>Create new label: "{searchValue}"</span>
                        </button>

                        <Popover
                          open={colorPickerOpen}
                          onOpenChange={setColorPickerOpen}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full flex items-center px-3 py-2 text-sm text-left text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <div className="flex-shrink-0 w-4 mr-2" />
                              <span>Pick a color for label</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-64 p-2"
                            align="start"
                            sideOffset={5}
                          >
                            <div className="grid grid-cols-1 gap-1">
                              {labelColors.map((color) => (
                                <button
                                  key={color.value}
                                  type="button"
                                  className={cn(
                                    "flex items-center px-3 py-2 text-sm text-left text-zinc-900 dark:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800",
                                    selectedColor === color.value &&
                                      "bg-zinc-100 dark:bg-zinc-800",
                                  )}
                                  onClick={() => {
                                    setSelectedColor(color.value);
                                    setColorPickerOpen(false);
                                  }}
                                >
                                  <span
                                    className="w-3 h-3 rounded-full mr-3"
                                    style={{
                                      backgroundColor: color.color,
                                    }}
                                  />
                                  <span>{color.label}</span>
                                  {selectedColor === color.value && (
                                    <Check className="w-4 h-4 ml-auto text-zinc-400" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <div className="flex items-center gap-3 mr-auto">
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
                <input
                  type="checkbox"
                  checked={createMore}
                  onChange={(e) => setCreateMore(e.target.checked)}
                  className="rounded border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-2 transition-all"
                />
                Create more
              </label>
            </div>

            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
            >
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateTaskModal;
