import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import toKebabCase from "@/lib/to-kebab-case";
import type { Column as ColumnType } from "@/types/project";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ColumnDropzone } from "./column-dropzone";
import { ColumnHeader } from "./column-header";

interface ColumnProps {
  column: ColumnType;
}

function Column({ column }: ColumnProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  return (
    <div className="flex flex-col flex-1 min-w-80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xs rounded-lg border border-zinc-200 dark:border-zinc-800/50 shadow-xs relative group">
      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        status={toKebabCase(column.name)}
      />

      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800/50">
        <ColumnHeader column={column} />
      </div>

      <div className="p-3 overflow-y-auto overflow-x-hidden flex-1">
        <ColumnDropzone column={column} />
      </div>

      <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="w-full text-left px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 rounded-md flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <span>Add task</span>
        </button>
      </div>
    </div>
  );
}

export default Column;
