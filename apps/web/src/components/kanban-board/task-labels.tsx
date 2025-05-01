import { Badge } from "@/components/ui/badge";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";

const labelColors = [
  { value: "gray", label: "Grey", color: "#94a3b8" },
  { value: "dark-gray", label: "Dark Grey", color: "#64748b" },
  { value: "purple", label: "Purple", color: "#a855f7" },
  { value: "teal", label: "Teal", color: "#14b8a6" },
  { value: "green", label: "Green", color: "#22c55e" },
  { value: "yellow", label: "Yellow", color: "#eab308" },
  { value: "orange", label: "Orange", color: "#f97316" },
  { value: "pink", label: "Pink", color: "#ec4899" },
  { value: "red", label: "Red", color: "#ef4444" },
];

type LabelColor =
  | "gray"
  | "dark-gray"
  | "purple"
  | "teal"
  | "green"
  | "yellow"
  | "orange"
  | "pink"
  | "red";

type Label = {
  id: string;
  name: string;
  color: string;
  taskId: string;
  createdAt: string;
};

function TaskCardLabels({ taskId }: { taskId: string }) {
  const { data: labels = [] } = useGetLabelsByTask(taskId);

  if (!labels.length) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {labels.map((label: Label) => (
        <Badge
          key={label.id}
          badgeColor={label.color as LabelColor}
          variant="outline"
          className="px-2 py-0.5 text-[10px] flex items-center"
        >
          <span
            className="inline-block w-1.5 h-1.5 mr-1 rounded-full"
            style={{
              backgroundColor:
                labelColors.find((c) => c.value === label.color)?.color ||
                "#94a3b8",
            }}
          />
          <span className="truncate max-w-[80px]">{label.name}</span>
        </Badge>
      ))}
    </div>
  );
}

export default TaskCardLabels;
