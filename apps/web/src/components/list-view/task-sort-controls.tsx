import { cn } from "@/lib/cn";
import { ArrowDown, ArrowUp } from "lucide-react";

export type SortField =
  | "title"
  | "dueDate"
  | "priority"
  | "userEmail"
  | "createdAt";
export type SortDirection = "asc" | "desc";

interface TaskSortControlsProps {
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
}

export function TaskSortControls({
  sortField,
  sortDirection,
  onSortChange,
}: TaskSortControlsProps) {
  const sortFields: { value: SortField; label: string }[] = [
    { value: "title", label: "Title" },
    { value: "dueDate", label: "Due Date" },
    { value: "priority", label: "Priority" },
    { value: "userEmail", label: "Assignee" },
    { value: "createdAt", label: "Created At" },
  ];

  return (
    <div className="flex items-center gap-2">
      <select
        value={sortField}
        onChange={(e) => {
          const field = e.target.value as SortField;
          onSortChange(field, sortDirection);
        }}
        className={cn(
          "text-sm bg-transparent border border-zinc-200 dark:border-zinc-800",
          "rounded-md px-2 py-1 focus:outline-none focus:ring-2",
          "focus:ring-zinc-200 dark:focus:ring-zinc-800",
          "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {sortFields.map((field) => (
          <option key={field.value} value={field.value}>
            {field.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() =>
          onSortChange(sortField, sortDirection === "asc" ? "desc" : "asc")
        }
        className={cn(
          "p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
          "transition-colors",
        )}
      >
        {sortDirection === "asc" ? (
          <ArrowUp className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        ) : (
          <ArrowDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        )}
      </button>
    </div>
  );
}
