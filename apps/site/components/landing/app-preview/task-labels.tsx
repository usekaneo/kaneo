import { resolveLabelColor } from "./label-color";

// Same dot-and-name labels as apps/web's kanban-board/task-labels.
export function PreviewTaskLabels({
  labels,
}: {
  labels: Array<{ id: string; name: string; color: string }>;
}) {
  if (!labels.length) return null;

  const sortedLabels = [...labels].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-1">
      {sortedLabels.map((label) => (
        <span
          key={label.id}
          className="flex max-w-full min-w-0 items-center gap-1.5 text-[10px] font-medium text-foreground/85"
        >
          <span
            aria-hidden="true"
            className="inline-block size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: resolveLabelColor(label.color) }}
          />
          <span className="min-w-0 truncate" title={label.name}>
            {label.name}
          </span>
        </span>
      ))}
    </div>
  );
}
