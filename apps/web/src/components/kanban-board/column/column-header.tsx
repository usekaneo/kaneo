import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import toKebabCase from "@/lib/to-kebab-case";
import type { Column } from "@/types/project";
import { Plus } from "lucide-react";
import { useState } from "react";

interface ColumnHeaderProps {
  column: Column;
}

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  return (
    <>
      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        status={toKebabCase(column.name)}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            {column.name}
          </h3>
          <span className="text-sm text-zinc-500 dark:text-zinc-500">
            {column.tasks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="text-left px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 rounded-md flex items-center transition-all group"
        >
          <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>
    </>
  );
}
