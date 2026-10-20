import { useQueryClient } from "@tanstack/react-query";
import { Plus, TagIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useAttachLabelToTask from "@/hooks/mutations/label/use-attach-label-to-task";
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useDetachLabelFromTask from "@/hooks/mutations/label/use-detach-label-from-task";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getTaskLabelOptions } from "@/lib/get-task-label-options";
import { resolveLabelColor } from "@/lib/label-color";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const labelColors = [
  { value: "gray", key: "stone", color: "var(--color-stone-500)" },
  { value: "dark-gray", key: "slate", color: "var(--color-slate-500)" },
  { value: "purple", key: "lavender", color: "var(--color-violet-500)" },
  { value: "teal", key: "sage", color: "var(--color-emerald-600)" },
  { value: "green", key: "forest", color: "var(--color-green-600)" },
  { value: "yellow", key: "amber", color: "var(--color-amber-600)" },
  { value: "orange", key: "terracotta", color: "var(--color-orange-600)" },
  { value: "pink", key: "rose", color: "var(--color-rose-600)" },
  { value: "red", key: "crimson", color: "var(--color-red-600)" },
];

const CREATE_LABEL = ":create";

type TaskLabelsPopoverProps = {
  task: Task;
  workspaceId: string;
  children: React.ReactNode;
};

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

export default function TaskLabelsPopover({
  task,
  workspaceId,
  children,
}: TaskLabelsPopoverProps) {
  const [open, setOpen] = useState(false);
  const { canUpdateLabels } = useWorkspacePermission();

  if (!canUpdateLabels()) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        {open && (
          <TaskLabelsMenu
            task={task}
            workspaceId={workspaceId}
            onClose={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

type TaskLabelsMenuProps = {
  task: Task;
  workspaceId: string;
  onClose: () => void;
};

function TaskLabelsMenu({ task, workspaceId, onClose }: TaskLabelsMenuProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [newLabelName, setNewLabelName] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { mutateAsync: attachLabel } = useAttachLabelToTask();
  const { mutateAsync: createLabel } = useCreateLabel();
  const { mutateAsync: detachLabel } = useDetachLabelFromTask();
  const { canCreateLabels } = useWorkspacePermission();

  const { data: taskLabels = [] } = useGetLabelsByTask(task.id);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);
  const name = query.trim();
  const assignedNames = new Set(taskLabels.map((label) => label.name));
  const canCreateLabel =
    canCreateLabels() &&
    Boolean(name) &&
    !workspaceLabels.some(
      (label) =>
        label.taskId === null &&
        label.name.toLowerCase() === name.toLowerCase(),
    );

  const refreshTasks = () =>
    queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });

  const toggleLabel = async (labelId: string) => {
    const workspaceLabel = workspaceLabels.find(
      (label) => label.id === labelId,
    );
    if (!workspaceLabel) return;
    try {
      if (assignedNames.has(workspaceLabel.name)) {
        const taskLabel = taskLabels.find(
          (label) => label.name === workspaceLabel.name,
        );
        if (taskLabel?.id) await detachLabel({ labelId: taskLabel.id });
      } else {
        if (workspaceLabel.taskId !== null) return;
        await attachLabel({ labelId: workspaceLabel.id, taskId: task.id });
      }
      await refreshTasks();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.labels.updateError"),
      );
    }
  };

  const createWithColor = async (color: string) => {
    if (!newLabelName) return;
    onClose();
    try {
      const created = await createLabel({
        name: newLabelName,
        color,
        workspaceId,
      });
      await attachLabel({ labelId: created.id, taskId: task.id });
      await refreshTasks();
      toast.success(t("tasks:popover.labels.createSuccess"), { icon: TagIcon });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.labels.createError"),
      );
    }
  };

  const labelOptions = [
    ...getTaskLabelOptions(workspaceLabels, task.id).map((label) => ({
      value: label.id,
      label: label.name,
      icon: <ColorDot color={resolveLabelColor(label.color)} />,
      selected: assignedNames.has(label.name),
    })),
    ...(canCreateLabel
      ? [
          {
            value: CREATE_LABEL,
            label: t("tasks:popover.labels.create", { name }),
            icon: <Plus />,
          },
        ]
      : []),
  ];

  return newLabelName === null ? (
    <OptionMenu
      key="labels"
      label={t("tasks:properties.labels")}
      placeholder={t("tasks:popover.labels.searchPlaceholder")}
      options={labelOptions}
      onQueryChange={setQuery}
      onSelect={(value) => {
        if (value === CREATE_LABEL) setNewLabelName(name);
        else void toggleLabel(value);
      }}
    />
  ) : (
    <OptionMenu
      key="colors"
      label={t("tasks:popover.labels.chooseColor")}
      placeholder={t("tasks:popover.labels.chooseColor")}
      options={labelColors.map((color) => ({
        value: color.value,
        label: t(`tasks:popover.labels.colors.${color.key}`),
        icon: <ColorDot color={color.color} />,
      }))}
      onSelect={createWithColor}
    />
  );
}
