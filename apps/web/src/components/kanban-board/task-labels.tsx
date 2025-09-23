import { Badge } from "@/components/ui/badge";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";

const labelColors = [
  { value: "gray", label: "Stone", color: "#78716c" },
  { value: "dark-gray", label: "Slate", color: "#64748b" },
  { value: "purple", label: "Lavender", color: "#8b5cf6" },
  { value: "teal", label: "Sage", color: "#059669" },
  { value: "green", label: "Forest", color: "#16a34a" },
  { value: "yellow", label: "Amber", color: "#d97706" },
  { value: "orange", label: "Terracotta", color: "#ea580c" },
  { value: "pink", label: "Rose", color: "#e11d48" },
  { value: "red", label: "Crimson", color: "#dc2626" },
];

function TaskCardLabels({ taskId }: { taskId: string }) {
  const { data: labels = [] } = useGetLabelsByTask(taskId);

  if (!labels.length) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label: { id: string; name: string; color: string }) => (
        <Badge
          key={label.id}
          color={label.color}
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
