import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

export type ParentTaskSummary = {
  number: number | null;
  title: string;
  projectSlug: string;
};

// One truncated line naming a subtask's parent; the full text is the tooltip.
export function ParentTaskHint({
  parent,
  className,
}: {
  parent: ParentTaskSummary | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!parent) return null;
  const id =
    parent.number == null
      ? parent.projectSlug
      : `${parent.projectSlug}-${parent.number}`;
  const text = t("tasks:parentHint", { id, title: parent.title });

  return (
    <span title={text} className={cn("min-w-0 truncate", className)}>
      {text}
    </span>
  );
}
