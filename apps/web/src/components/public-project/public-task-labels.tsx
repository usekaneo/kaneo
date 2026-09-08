import { Badge } from "@/components/ui/badge";
import { resolveLabelColor } from "@/lib/label-color";

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
              backgroundColor: resolveLabelColor(label.color),
            }}
          />
          <span className="max-w-20 truncate">{label.name}</span>
        </Badge>
      ))}
    </div>
  );
}
