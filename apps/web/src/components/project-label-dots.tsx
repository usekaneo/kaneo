import { resolveLabelColor } from "@/lib/label-color";

const MAX_DOTS = 3;

type ProjectLabelDotsProps = {
  labels: Array<{ id: string; name: string; color: string }>;
};

// A project's default labels as overlapping color dots beside its name.
export function ProjectLabelDots({ labels }: ProjectLabelDotsProps) {
  if (labels.length === 0) return null;
  const names = labels.map((label) => label.name).join(", ");

  return (
    <span title={names} className="flex shrink-0 items-center -space-x-0.5">
      <span className="sr-only">{names}</span>
      {labels.slice(0, MAX_DOTS).map((label) => (
        <span
          key={label.id}
          aria-hidden="true"
          className="size-2 rounded-full ring-1 ring-sidebar"
          style={{ backgroundColor: resolveLabelColor(label.color) }}
        />
      ))}
    </span>
  );
}
