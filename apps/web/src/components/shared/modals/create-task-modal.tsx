import { useLocation } from "@tanstack/react-router";
import { produce } from "immer";
import {
  CalendarIcon,
  Check,
  Plus,
  Search,
  Tag,
  UserIcon,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import TaskDescriptionEditor from "@/components/task/task-description-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";

type CreateTaskModalProps = {
  open: boolean;
  onClose: () => void;
  status?: string;
  projectId?: string;
};

type Priority = "no-priority" | "low" | "medium" | "high" | "urgent";

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
  id: string;
  name: string;
  color: string;
  taskId: string | null;
  workspaceId: string;
  createdAt: string;
};

type PopoverStep = "select" | "color";

function normalizeTask(
  task: Partial<Task> &
    Pick<Task, "id" | "title" | "status" | "projectId" | "createdAt">,
): Task {
  return {
    ...task,
    number: task.number ?? null,
    description: task.description ?? null,
    priority: task.priority ?? null,
    startDate: task.startDate ?? null,
    dueDate: task.dueDate ?? null,
    position: task.position ?? 0,
    userId: task.userId ?? null,
    assigneeId: task.assigneeId ?? task.userId ?? null,
    assigneeName: task.assigneeName ?? null,
    assigneeImage: task.assigneeImage ?? null,
    labels: task.labels ?? [],
    externalLinks: task.externalLinks ?? [],
  };
}

function CreateTaskModal({
  open,
  onClose,
  status,
  projectId,
}: CreateTaskModalProps) {
  const { t } = useTranslation();
  const { project, setProject } = useProjectStore();

  const labelColors = useMemo(
    () =>
      [
        {
          value: "gray" as LabelColor,
          labelKey: "stone" as const,
          color: "var(--color-stone-500)",
        },
        {
          value: "dark-gray" as LabelColor,
          labelKey: "slate" as const,
          color: "var(--color-slate-500)",
        },
        {
          value: "purple" as LabelColor,
          labelKey: "lavender" as const,
          color: "var(--color-violet-500)",
        },
        {
          value: "teal" as LabelColor,
          labelKey: "sage" as const,
          color: "var(--color-emerald-600)",
        },
        {
          value: "green" as LabelColor,
          labelKey: "forest" as const,
          color: "var(--color-green-600)",
        },
        {
          value: "yellow" as LabelColor,
          labelKey: "amber" as const,
          color: "var(--color-amber-600)",
        },
        {
          value: "orange" as LabelColor,
          labelKey: "terracotta" as const,
          color: "var(--color-orange-600)",
        },
        {
          value: "pink" as LabelColor,
          labelKey: "rose" as const,
          color: "var(--color-rose-600)",
        },
        {
          value: "red" as LabelColor,
          labelKey: "crimson" as const,
          color: "var(--color-red-600)",
        },
      ].map(({ labelKey, ...rest }) => ({
        ...rest,
        label: t(`common:modals.createTask.labelColors.${labelKey}`),
      })),
    [t],
  );
  const location = useLocation();
  const { data: workspace } = useActiveWorkspace();
  const { mutateAsync: createLabel } = useCreateLabel();
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(
    workspace?.id || "",
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("no-priority");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [createMore, setCreateMore] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [draftTask, setDraftTask] = useState<Task | null>(null);

  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelsStep, setLabelsStep] = useState<PopoverStep>("select");
  const [searchValue, setSearchValue] = useState("");
  const [selectedColor, setSelectedColor] = useState<LabelColor>("gray");
  const [newLabelName, setNewLabelName] = useState("");

  const routeProjectId =
    location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? null;
  const resolvedProjectId = projectId || project?.id || routeProjectId || "";

  const searchInputRef = useRef<HTMLInputElement>(null);
  const draftCreationPromiseRef = useRef<Promise<Task> | null>(null);
  const didSubmitRef = useRef(false);

  const { mutateAsync: createTask } = useCreateTask();
  const { mutateAsync: updateTask } = useUpdateTask();
  const { mutateAsync: deleteTask } = useDeleteTask();

  const filteredLabels = (() => {
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
  })();

  const isCreatingNewLabel =
    searchValue &&
    !workspaceLabels.some(
      (label) => label.name.toLowerCase() === searchValue.toLowerCase(),
    );

  const handleClose = () => {
    const shouldDeleteDraft = draftTask && !didSubmitRef.current;

    setTitle("");
    setDescription("");
    setPriority("no-priority");
    setAssigneeId("");
    setStartDate(undefined);
    setDueDate(undefined);
    setCreateMore(false);
    setLabels([]);
    setLabelsStep("select");
    setSearchValue("");
    setSelectedColor("gray");
    setNewLabelName("");
    draftCreationPromiseRef.current = null;
    didSubmitRef.current = false;
    setDraftTask(null);
    onClose();

    if (shouldDeleteDraft) {
      void deleteTask(draftTask.id).catch(() => {
        // ignore cleanup failures for abandoned empty drafts
      });
    }
  };

  const syncTaskIntoProject = useCallback(
    (task: Task) => {
      if (!project) return;

      const updatedProject = produce(project, (draft) => {
        let existingTask:
          | (typeof draft.columns)[number]["tasks"][number]
          | undefined;

        for (const column of draft.columns ?? []) {
          const taskIndex = column.tasks.findIndex(
            (columnTask) => columnTask.id === task.id,
          );

          if (taskIndex !== -1) {
            existingTask = column.tasks[taskIndex];
            column.tasks.splice(taskIndex, 1);
            break;
          }
        }

        if (task.status === "planned" || task.status === "archived") {
          return;
        }

        const targetColumn = draft.columns?.find(
          (column) => column.id === task.status,
        );
        if (!targetColumn) return;

        targetColumn.tasks.push({
          ...existingTask,
          ...task,
          assigneeId: task.userId,
          assigneeName:
            workspace?.members?.find((member) => member.userId === task.userId)
              ?.user?.name ??
            existingTask?.assigneeName ??
            null,
          assigneeImage:
            workspace?.members?.find((member) => member.userId === task.userId)
              ?.user?.image ??
            existingTask?.assigneeImage ??
            null,
          position: task.position ?? 0,
        });
      });

      setProject(updatedProject);
    },
    [project, setProject, workspace?.members],
  );

  const ensureDraftTask = useCallback(async () => {
    if (draftTask) {
      return draftTask.id;
    }

    if (draftCreationPromiseRef.current) {
      const pendingTask = await draftCreationPromiseRef.current;
      return pendingTask.id;
    }

    if (!resolvedProjectId) {
      toast.error(t("common:modals.createTask.chooseProjectForImages"));
      return null;
    }

    const draftStatus = "planned";
    const draftPromise = createTask({
      title: title.trim() || t("common:modals.createTask.untitledTask"),
      description: description.trim() || "",
      userId: assigneeId,
      priority,
      projectId: resolvedProjectId,
      startDate: startDate ? startDate.toISOString() : undefined,
      dueDate: dueDate ? dueDate.toISOString() : undefined,
      status: draftStatus,
    }).then((task) => normalizeTask(task));

    draftCreationPromiseRef.current = draftPromise;

    try {
      const createdTask = await draftPromise;
      setDraftTask(createdTask);
      return createdTask.id;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:modals.createTask.prepareTaskError"),
      );
      return null;
    } finally {
      draftCreationPromiseRef.current = null;
    }
  }, [
    assigneeId,
    createTask,
    description,
    draftTask,
    startDate,
    dueDate,
    priority,
    resolvedProjectId,
    title,
    t,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !resolvedProjectId || !workspace?.id) return;

    try {
      const taskStatus = status ?? "to-do";
      didSubmitRef.current = true;

      const savedTask = draftTask
        ? normalizeTask(
            await updateTask({
              ...draftTask,
              title: title.trim(),
              description: description.trim() || "",
              userId: assigneeId || null,
              status: taskStatus,
              priority,
              startDate: startDate ? startDate.toISOString() : null,
              dueDate: dueDate ? dueDate.toISOString() : null,
              projectId: resolvedProjectId,
            }),
          )
        : normalizeTask(
            await createTask({
              title: title.trim(),
              description: description.trim() || "",
              userId: assigneeId,
              priority,
              projectId: resolvedProjectId,
              startDate: startDate ? startDate.toISOString() : undefined,
              dueDate: dueDate ? dueDate.toISOString() : undefined,
              status: taskStatus,
            }),
          );

      for (const label of labels) {
        try {
          await createLabel({
            name: label.name,
            color: label.color,
            taskId: savedTask.id,
            workspaceId: workspace.id,
          });
        } catch (error) {
          console.error("Failed to create label:", error);
        }
      }

      setDraftTask(savedTask);
      syncTaskIntoProject(savedTask);
      toast.success(
        draftTask
          ? t("common:modals.createTask.successUpdated")
          : t("common:modals.createTask.successCreated"),
      );

      if (createMore) {
        setTitle("");
        setDescription("");
        setPriority("no-priority");
        setAssigneeId("");
        setStartDate(undefined);
        setDueDate(undefined);
        setLabels([]);
        setLabelsStep("select");
        setSearchValue("");
        setSelectedColor("gray");
        setNewLabelName("");
        draftCreationPromiseRef.current = null;
        didSubmitRef.current = false;
        setDraftTask(null);
      } else {
        handleClose();
      }
    } catch (error) {
      didSubmitRef.current = false;
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:modals.createTask.createError"),
      );
    }
  };

  const priorityOptions = useMemo(
    () =>
      (["no-priority", "low", "medium", "high", "urgent"] as const).map(
        (value) => ({
          value,
          label: t(`tasks:priority.${value}`),
        }),
      ),
    [t],
  );

  const selectedPriority = priorityOptions.find((p) => p.value === priority);

  const statusLabel = useMemo(() => {
    if (status) {
      return t(`tasks:status.${status}`);
    }
    return t("tasks:status.in-progress");
  }, [status, t]);
  const selectedUser = workspace?.members?.find((u) => u.userId === assigneeId);

  useEffect(() => {
    if (labelsOpen && labelsStep === "select" && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [labelsOpen, labelsStep]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (title.trim() && project?.id && workspace?.id) {
          const form = document.querySelector("form");
          if (form) {
            form.dispatchEvent(
              new Event("submit", { cancelable: true, bubbles: true }),
            );
          }
        }
      }
    },
    [open, title, project?.id, workspace?.id],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const resetLabelsPopover = () => {
    setLabelsStep("select");
    setSearchValue("");
    setNewLabelName("");
    setSelectedColor("gray");
  };

  const handleLabelsClose = () => {
    setLabelsOpen(false);
    setTimeout(resetLabelsPopover, 200);
  };

  const toggleLabel = (labelName: string) => {
    const existingLabel = labels.find((l) => l.name === labelName);
    if (existingLabel) {
      setLabels(labels.filter((l) => l.name !== labelName));
    } else {
      const workspaceLabel = workspaceLabels.find((l) => l.name === labelName);
      if (workspaceLabel) {
        setLabels([
          ...labels,
          {
            id: workspaceLabel.id,
            name: workspaceLabel.name,
            color: workspaceLabel.color,
            taskId: null,
            workspaceId: workspaceLabel.workspaceId || "",
            createdAt: workspaceLabel.createdAt,
          },
        ]);
      }
    }
  };

  const handleCreateNewClick = () => {
    setNewLabelName(searchValue);
    setLabelsStep("color");
  };

  const handleColorSelect = async (color: LabelColor) => {
    setSelectedColor(color);

    if (!newLabelName.trim() || !workspace?.id) return;

    try {
      const createdLabel = await createLabel({
        name: newLabelName.trim(),
        color: color,
        workspaceId: workspace.id,
      });

      const newLabel: Label = {
        id: createdLabel.id,
        name: createdLabel.name,
        color: createdLabel.color,
        taskId: createdLabel.taskId ?? null,
        workspaceId: createdLabel.workspaceId ?? workspace.id,
        createdAt: createdLabel.createdAt,
      };

      setLabels([...labels, newLabel]);
      toast.success(t("common:modals.createTask.labelCreated"));
      handleLabelsClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:modals.createTask.labelCreateError"),
      );
    }
  };

  const removeLabel = (labelName: string) => {
    setLabels(labels.filter((l) => l.name !== labelName));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="kaneo-create-task-modal max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle asChild>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="text-muted-foreground font-semibold tracking-wider text-sm">
                  {project?.slug?.toUpperCase() ||
                    t("common:modals.createTask.breadcrumbTask")}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="text-foreground font-medium text-sm">
                  {t("common:modals.createTask.title")}
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("common:modals.createTask.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 space-y-6"
        >
          <div className="flex-1 min-h-0 overflow-y-auto space-y-6 px-6">
            <Input
              unstyled
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder={t("common:modals.createTask.taskTitlePlaceholder")}
              className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-3 [&_[data-slot=input]]:text-2xl [&_[data-slot=input]]:leading-tight [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:tracking-tight [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:placeholder:text-muted-foreground [&_[data-slot=input]]:outline-none"
              required
            />

            <div className="min-h-[200px]">
              <TaskDescriptionEditor
                value={description}
                onChange={setDescription}
                placeholder={t(
                  "common:modals.createTask.descriptionPlaceholder",
                )}
                taskId={draftTask?.id}
                ensureTaskId={ensureDraftTask}
              />
            </div>

            {labels.length > 0 && (
              <div className="flex flex-wrap mb-2">
                {labels.map((label) => (
                  <Badge
                    key={label.name}
                    color={label.color}
                    variant="outline"
                    className="flex items-center gap-1 pl-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => removeLabel(label.name)}
                  >
                    <span
                      className="inline-block w-2 h-2 mr-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          labelColors.find((c) => c.value === label.color)
                            ?.color || "var(--color-neutral-400)",
                      }}
                    />
                    <span className="relative max-w-20 truncate" style={{ top: "-2px" }}>
                      {label.name}
                    </span>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 py-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/50 text-foreground rounded-md text-xs font-medium border border-border">
                <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
                {statusLabel}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border border-border hover:bg-accent/50",
                      startDate
                        ? "bg-accent/30 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>
                      {startDate
                        ? formatDateMedium(startDate)
                        : t("common:modals.createTask.startDate")}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    className="w-full bg-popover"
                  />
                  {startDate && (
                    <div className="p-2 border-t border-border">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setStartDate(undefined)}
                      >
                        {t("common:modals.createTask.clearStartDate")}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border border-border hover:bg-accent/50",
                      priority !== "no-priority"
                        ? "bg-accent/30 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {getPriorityIcon(priority)}
                    <span>
                      {selectedPriority
                        ? selectedPriority.label
                        : t("common:modals.createTask.priority")}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  <div className="space-y-1">
                    {priorityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 text-left transition-colors h-8"
                        onClick={() => setPriority(option.value as Priority)}
                      >
                        {getPriorityIcon(option.value)}
                        <span className="text-sm">{option.label}</span>
                        {priority === option.value && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
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
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border border-border hover:bg-accent/50",
                      selectedUser
                        ? "bg-accent/30 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {selectedUser ? (
                      <>
                        <Avatar className="h-4 w-4">
                          <AvatarImage
                            src={selectedUser?.user?.image ?? ""}
                            alt={selectedUser?.user?.name || ""}
                          />
                          <AvatarFallback className="text-[10px] font-medium border border-border/30">
                            {selectedUser?.user?.name
                              ?.charAt(0)
                              .toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedUser.user?.name}</span>
                      </>
                    ) : (
                      <>
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>{t("common:modals.createTask.assign")}</span>
                      </>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  <div className="space-y-1">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 text-left transition-colors h-8"
                      onClick={() => setAssigneeId("")}
                    >
                      <div
                        className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center"
                        title={t(
                          "common:modals.createTask.assignUnassignedTitle",
                        )}
                      >
                        <span className="text-[10px] font-medium text-muted-foreground">
                          ?
                        </span>
                      </div>
                      <span className="text-sm">
                        {t("common:modals.createTask.assignUnassigned")}
                      </span>
                      {!assigneeId && <Check className="ml-auto h-4 w-4" />}
                    </button>
                    {workspace?.members?.map((member) => (
                      <button
                        key={member.userId}
                        type="button"
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 text-left transition-colors h-8"
                        onClick={() => setAssigneeId(member.userId || "")}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={member?.user?.image ?? ""}
                            alt={member?.user?.name || ""}
                          />
                          <AvatarFallback className="text-xs font-medium border border-border/30">
                            {member?.user?.name?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{member?.user?.name}</span>
                        {assigneeId === member.userId && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
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
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border border-border hover:bg-accent/50",
                      dueDate
                        ? "bg-accent/30 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>
                      {dueDate
                        ? formatDateMedium(dueDate)
                        : t("common:modals.createTask.dueDate")}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    className="w-full bg-popover"
                  />
                  {dueDate && (
                    <div className="p-2 border-t border-border">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setDueDate(undefined)}
                      >
                        {t("common:modals.createTask.clearDueDate")}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border border-border hover:bg-accent/50",
                      labels.length > 0
                        ? "bg-accent/30 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>{t("common:modals.createTask.labels")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  {labelsStep === "select" && (
                    <div className="w-auto">
                      <div className="flex items-center gap-2 p-2 border-b border-border">
                        <Search className="w-3 h-3 text-muted-foreground" />
                        <input
                          ref={searchInputRef}
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          placeholder={t(
                            "common:modals.createTask.searchLabels",
                          )}
                          className="w-full bg-transparent border-none text-foreground text-xs focus:outline-none placeholder:text-muted-foreground"
                        />
                      </div>

                      <div className="py-1">
                        {filteredLabels.length === 0 &&
                          searchValue.length === 0 && (
                            <span className="text-xs text-muted-foreground px-2">
                              {t("common:modals.createTask.noLabelsFound")}
                            </span>
                          )}
                        {filteredLabels.map((label) => (
                          <button
                            key={label.id}
                            type="button"
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent/50 text-left"
                            onClick={() => toggleLabel(label.name)}
                          >
                            <div className="flex-shrink-0 w-3 flex justify-center">
                              {labels.some((l) => l.name === label.name) && (
                                <Check className="w-3 h-3" />
                              )}
                            </div>
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  labelColors.find(
                                    (c) => c.value === label.color,
                                  )?.color || "var(--color-neutral-400)",
                              }}
                            />
                            <span className="relative max-w-20 truncate" style={{ top: "-2px" }}>
                              {label.name}
                            </span>
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
                                  labelColors.find(
                                    (c) => c.value === selectedColor,
                                  )?.color || "var(--color-neutral-400)",
                              }}
                            />
                            <span className="truncate">
                              {t("common:modals.createTask.createLabel", {
                                name: searchValue,
                              })}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {labelsStep === "color" && (
                    <div className="w-auto">
                      <div className="flex items-center justify-between p-2 border-b border-border">
                        <span className="text-xs font-medium">
                          {t("common:modals.createTask.chooseColor")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLabelsStep("select")}
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
                            onClick={() =>
                              handleColorSelect(color.value as LabelColor)
                            }
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
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t border-border bg-background px-6 py-4">
            <div className="flex items-center gap-3 mr-auto">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <input
                  type="checkbox"
                  checked={createMore}
                  onChange={(e) => setCreateMore(e.target.checked)}
                  className="rounded border-border bg-background text-primary focus:ring-ring focus:ring-offset-0 focus:ring-2 transition-all"
                />
                {t("common:modals.createTask.createMore")}
              </label>
            </div>

            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-accent"
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              size="sm"
              className="disabled:opacity-50"
            >
              {t("common:modals.createTask.createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateTaskModal;
