import {
  type SortDirection,
  type SortField,
  TaskSortControls,
} from "@/components/list-view/task-sort-controls";
import type { Column } from "@/types/project";
import { useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import TaskCard from "../task-card";

interface ColumnDropzoneProps {
  column: Column;
}

export function ColumnDropzone({ column }: ColumnDropzoneProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
  });

  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  const sortTasks = (tasks: typeof column.tasks) => {
    return [...tasks].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "dueDate": {
          if (!a.dueDate && !b.dueDate) comparison = 0;
          else if (!a.dueDate) comparison = 1;
          else if (!b.dueDate) comparison = -1;
          else {
            const dateA = new Date(a.dueDate);
            const dateB = new Date(b.dueDate);
            comparison = dateA.getTime() - dateB.getTime();
          }
          break;
        }
        case "priority": {
          if (!a.priority && !b.priority) comparison = 0;
          else if (!a.priority) comparison = 1;
          else if (!b.priority) comparison = -1;
          else comparison = a.priority.localeCompare(b.priority);
          break;
        }
        case "userEmail": {
          if (!a.userEmail && !b.userEmail) comparison = 0;
          else if (!a.userEmail) comparison = 1;
          else if (!b.userEmail) comparison = -1;
          else comparison = a.userEmail.localeCompare(b.userEmail);
          break;
        }
        case "createdAt": {
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  const sortedTasks = sortTasks(column.tasks);

  return (
    <div ref={setNodeRef} className="flex-1">
      <div className="mb-2">
        <TaskSortControls
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
        />
      </div>

      <div className="flex flex-col gap-2">
        {sortedTasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
