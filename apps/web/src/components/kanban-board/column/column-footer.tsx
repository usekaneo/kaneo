import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import toKebabCase from "@/lib/to-kebab-case";
import type { Column } from "@/types/project";
import { Plus } from "lucide-react";
import { useState } from "react";

interface ColumnFooterProps {
  column: Column;
}

export function ColumnFooter({ column }: ColumnFooterProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  return (
    <>
      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        status={toKebabCase(column.name)}
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="w-full text-left px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 rounded-md flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <span>Add task</span>
        </button>
      </div>
    </>
  );
}
