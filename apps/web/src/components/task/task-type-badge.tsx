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

  const known = isKnownType(task.type);
  const label = known ? t(TYPE_LABEL_KEYS[task.type]) : task.type;
  const Icon = known ? TYPE_ICONS[task.type] : CircleCheckBig;

  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
