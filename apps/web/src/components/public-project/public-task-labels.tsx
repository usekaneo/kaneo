import { Badge } from "@/components/ui/badge";
import labelColors from "@/constants/label-colors";

type PublicTaskLabelsProps = {
  labels: Array<{ id: string; name: string; color: string }>;
};

export function PublicTaskLabels({ labels }: PublicTaskLabelsProps) {
  if (!labels || labels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <Badge
          key={label.id}
          variant="outline"
          className="px-2 py-0.5 text-[10px] flex items-center"
        >
          <span
            className="inline-block w-1.5 h-1.5 mr-1 rounded-full"
            style={{
              backgroundColor:
                labelColors.find((c) => c.value === label.color)?.color ||
                "var(--color-neutral-400)",
            }}
          />
          <span className="truncate max-w-[80px]">{label.name}</span>
        </Badge>
      ))}
    </div>
  );
}
