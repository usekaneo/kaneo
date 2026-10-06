import { useTranslation } from "react-i18next";
import { localeCompareSort } from "@/lib/format";
import { resolveLabelColor } from "@/lib/label-color";
import type Task from "@/types/task";

export function TaskLabels({
  labels,
}: {
  labels: NonNullable<Task["labels"]>;
}) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;

  if (!labels.length) return null;

  const sortedLabels = [...labels].sort((a, b) =>
    localeCompareSort(a.name, b.name, locale),
  );

  return (
    <div className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-1">
      {sortedLabels.map((label) => (
        <span
          key={label.id}
          data-slot="task-label"
          className="flex max-w-full min-w-0 items-center gap-1.5 font-medium text-[10px] text-foreground/85"
        >
          <span
            aria-hidden="true"
            className="inline-block size-1.5 shrink-0 rounded-full"
            style={{
              backgroundColor: resolveLabelColor(label.color),
            }}
          />
          <span className="min-w-0 truncate" title={label.name}>
            {label.name}
          </span>
        </span>
      ))}
    </div>
  );
}
