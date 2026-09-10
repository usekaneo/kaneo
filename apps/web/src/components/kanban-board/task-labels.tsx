import { Badge } from "@/components/ui/badge";
import { resolveLabelColor } from "@/lib/label-color";
import type Task from "@/types/task";

export function TaskLabels({
  labels,
}: {
  labels: NonNullable<Task["labels"]>;
}) {
  if (!labels.length) return null;

  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {labels.map((label) => (
        <Badge
          key={label.id}
          variant="outline"
          className="max-w-full min-w-0 px-2 py-0.5 text-[10px] flex items-center"
        >
          <span
            aria-hidden="true"
            className="inline-block w-1.5 h-1.5 mr-1 shrink-0 rounded-full"
            style={{
              backgroundColor: resolveLabelColor(label.color),
            }}
          />
          <span className="min-w-0 truncate" title={label.name}>
            {label.name}
          </span>
        </Badge>
      ))}
    </div>
  );
}
