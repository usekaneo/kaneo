import type { Column } from '@/types/project';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import TaskCard from '../task-card';

interface ColumnDropzoneProps {
  readonly column: Column;
}

export const ColumnDropzone = ({ column }: ColumnDropzoneProps) => {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      column,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex-1"
    >
      <SortableContext
        items={column.tasks}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};
