import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import toKebabCase from "@/lib/to-kebab-case";
import type { ProjectWithTasks } from "@/types/project";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ColumnDropzone } from "./column-dropzone";
import { ColumnHeader } from "./column-header";

interface ColumnProps {
  column: ProjectWithTasks["columns"][number];
}

function Column({ column }: ColumnProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDropzoneOver, setIsDropzoneOver] = useState(false);

  return (
    <div
      className={`flex flex-col h-full w-full min-h-0 backdrop-blur-xs rounded-lg relative group transition-all duration-300 ease-out ${
        isDropzoneOver
          ? "bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-200 dark:ring-indigo-800/50 shadow-md shadow-indigo-500/10"
          : "bg-zinc-50/30 dark:bg-zinc-900/30 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/40 hover:shadow-sm"
      }`}
    >
      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        status={toKebabCase(column.name)}
      />

      <div className="p-2 shrink-0">
        <ColumnHeader column={column} />
      </div>

      <div className="p-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
        <ColumnDropzone column={column} onIsOverChange={setIsDropzoneOver} />
      </div>

      <div className="p-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="w-full text-left px-2 py-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 rounded-md flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add task</span>
        </button>
      </div>
    </div>
  );
}

export default Column;
