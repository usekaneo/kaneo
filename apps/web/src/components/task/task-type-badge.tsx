import { Bug, CircleCheckBig } from "lucide-react";
import { useTranslation } from "react-i18next";
import type Task from "@/types/task";

type TaskTypeBadgeProps = {
  task: Pick<Task, "type">;
};

const TYPE_ICONS = {
  bug: Bug,
  task: CircleCheckBig,
} as const;

const TYPE_LABEL_KEYS = {
  bug: "tasks:type.bug",
  task: "tasks:type.task",
} as const;

export type TaskTypeName = keyof typeof TYPE_LABEL_KEYS;

function isKnownType(type: string): type is TaskTypeName {
  return type in TYPE_LABEL_KEYS;
}

// Displays the task's type in the properties rail. Tasks without a type keep
// the row empty, mirroring how the recurrence badge stays out of the way.
export default function TaskTypeBadge({ task }: TaskTypeBadgeProps) {
  const { t } = useTranslation();

  if (!task.type) return null;

  // The icon and label maps only cover the documented types, so a task with
  // an unknown custom type falls back to the generic icon and its raw label.
  if (!isKnownType(task.type)) {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
        <CircleCheckBig className="size-3.5" aria-hidden="true" />
        <span className="truncate">{task.type}</span>
      </span>
    );
  }

  const Icon = TYPE_ICONS[task.type];

  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="truncate">{t(TYPE_LABEL_KEYS[task.type])}</span>
    </span>
  );
}
