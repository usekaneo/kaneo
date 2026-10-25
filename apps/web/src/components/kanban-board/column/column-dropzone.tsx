import {
  SortableContext,
  type SortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ProjectWithTasks } from "@/types/project";
import TaskCard from "../task-card";

const keepOrder: SortingStrategy = () => null;

type ColumnDropzoneProps = {
  column: ProjectWithTasks["columns"][number];
  disableDragDrop?: boolean;
  disableSorting?: boolean;
};

export function ColumnDropzone({
  column,
  disableDragDrop = false,
  disableSorting = false,
}: ColumnDropzoneProps) {
  return (
    <SortableContext
      items={column.tasks}
      strategy={disableSorting ? keepOrder : verticalListSortingStrategy}
    >
      <div className="flex flex-col gap-1.5">
        {column.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            disableDragDrop={disableDragDrop}
            isFinalColumn={column.isFinal}
          />
        ))}
      </div>
    </SortableContext>
  );
}
