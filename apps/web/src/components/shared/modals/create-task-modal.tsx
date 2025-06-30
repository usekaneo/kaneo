import { Editor } from "@/components/common/editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetActiveWorkspaceUsers from "@/hooks/queries/workspace-users/use-active-workspace-users";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
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
  X,
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
  const [assigneeEmail, setAssigneeEmail] = useState("");
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
    setAssigneeEmail("");
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
        userEmail: assigneeEmail,
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
              assigneeEmail: assigneeEmail,
              assigneeName: assigneeEmail,
              position: 0,
            });
          }
        }
      });

      setProject(updatedProject);
      updateTask({ ...newTask, position: 0 });
      toast.success("Task created successfully");

      if (createMore) {
        setTitle("");
        setDescription("");
        setPriority("low");
        setAssigneeEmail("");
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
  const selectedUser = users?.find((u) => u.userEmail === assigneeEmail);

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
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 rounded-xl shadow-2xl border border-zinc-700/50 backdrop-blur-xl">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="text-sm text-zinc-400 font-semibold tracking-wider">
                  {project?.slug?.toUpperCase() || "TASK"}
                </div>
                <div className="w-1 h-1 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full" />
                <div className="text-sm text-zinc-300 font-medium">
                  New Task
                </div>
              </div>
              <Dialog.Close
                asChild
                className="text-zinc-400 hover:text-zinc-100 cursor-pointer p-2 hover:bg-zinc-800/50 rounded-lg transition-all duration-200"
              >
                <X size={18} />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6">
              <div className="space-y-6">
                <div className="pt-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                    placeholder="Task title"
                    className="text-xl font-semibold border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent text-white placeholder:text-zinc-400 tracking-tight"
                    required
                  />
                </div>

                <div>
                  <div className="border border-zinc-700/30 bg-zinc-800/30 min-h-[80px] rounded-lg py-0 px-3 shadow-sm backdrop-blur-sm">
                    <Editor
                      value={description}
                      onChange={setDescription}
                      placeholder="Add description..."
                    />
                  </div>
                </div>

                {labels.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {labels.map((label) => (
                      <Badge
                        key={label.name}
                        badgeColor={label.color}
                        variant="outline"
                        className="flex items-center gap-1 pl-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
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
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 rounded-md text-xs font-medium border border-amber-500/30">
                    <div className="w-1.5 h-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full shadow-sm" />
                    {status
                      ? status.charAt(0).toUpperCase() +
                        status.slice(1).replace("-", " ")
                      : "In Progress"}
                  </div>

                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 hover:scale-105 border",
                          selectedPriority && priority !== "low"
                            ? `${selectedPriority.color} ${selectedPriority.bg} ${selectedPriority.border}`
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-zinc-700/50",
                        )}
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>
                          {selectedPriority
                            ? selectedPriority.label
                            : "Priority"}
                        </span>
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        align="start"
                        className="z-50 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                      >
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
                              onClick={() =>
                                setPriority(option.value as Priority)
                              }
                            >
                              <Flag
                                className={cn("w-3.5 h-3.5", option.color)}
                              />
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>

                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 hover:scale-105 border",
                          selectedUser
                            ? "text-indigo-300 bg-indigo-500/10 border-indigo-500/30"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-zinc-700/50",
                        )}
                      >
                        {selectedUser ? (
                          <>
                            <div className="w-4 h-4 bg-zinc-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
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
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        align="start"
                        className="z-50 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                      >
                        <div className="space-y-1">
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-zinc-800/50 text-zinc-300 transition-all duration-200 hover:scale-[1.02]"
                            onClick={() => setAssigneeEmail("")}
                          >
                            <UserIcon className="w-4 h-4 text-zinc-500" />
                            Unassigned
                          </button>
                          {users?.map((user) => (
                            <button
                              key={user.userEmail}
                              type="button"
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-zinc-800/50 text-zinc-300 transition-all duration-200 hover:scale-[1.02]"
                              onClick={() =>
                                setAssigneeEmail(user.userEmail || "")
                              }
                            >
                              <div className="w-4 h-4 bg-zinc-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                                {user.userName?.charAt(0).toUpperCase() || "?"}
                              </div>
                              {user.userName}
                            </button>
                          ))}
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>

                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 hover:scale-105 border",
                          dueDate
                            ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-zinc-700/50",
                        )}
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>
                          {dueDate
                            ? format(dueDate, "MMM d, yyyy")
                            : "Due date"}
                        </span>
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        align="start"
                        className="z-50 w-auto bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                      >
                        <Calendar
                          mode="single"
                          selected={dueDate}
                          onSelect={setDueDate}
                          className="rounded-md border-0"
                        />
                        {dueDate && (
                          <div className="flex justify-between items-center pt-3 border-t border-zinc-800/50 mt-3">
                            <span className="text-sm text-zinc-400">
                              {format(dueDate, "EEEE, MMMM d, yyyy")}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDueDate(undefined)}
                              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>

                  <Popover.Root open={labelsOpen} onOpenChange={setLabelsOpen}>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 hover:scale-105 border",
                          labels.length > 0
                            ? "text-violet-300 bg-violet-500/10 border-violet-500/30"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-zinc-700/50",
                        )}
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Labels</span>
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        align="start"
                        className="w-80 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50"
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

                              <Popover.Root
                                open={colorPickerOpen}
                                onOpenChange={setColorPickerOpen}
                              >
                                <Popover.Trigger asChild>
                                  <button
                                    type="button"
                                    className="w-full flex items-center px-3 py-2 text-sm text-left text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                  >
                                    <div className="flex-shrink-0 w-4 mr-2" />
                                    <span>Pick a color for label</span>
                                  </button>
                                </Popover.Trigger>
                                <Popover.Portal>
                                  <Popover.Content
                                    align="start"
                                    className="w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-2 z-50"
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
                                  </Popover.Content>
                                </Popover.Portal>
                              </Popover.Root>
                            </div>
                          )}
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50 mt-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={createMore}
                        onChange={(e) => setCreateMore(e.target.checked)}
                        className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-2 transition-all"
                      />
                      Create more
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleClose}
                    className="bg-transparent border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800/50 hover:text-white hover:border-zinc-600 transition-all duration-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!title.trim()}
                    className="bg-indigo-600 text-white hover:bg-indigo-500 transition-all duration-200 disabled:opacity-50"
                  >
                    Create Task
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default CreateTaskModal;
