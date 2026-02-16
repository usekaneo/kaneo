import { Plus } from "lucide-react";
import { useState } from "react";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import toKebabCase from "@/lib/to-kebab-case";
import type { ProjectWithTasks } from "@/types/project";
import { ColumnDropzone } from "./column-dropzone";
import { ColumnHeader } from "./column-header";

type ColumnProps = {
  column: ProjectWithTasks["columns"][number];
};

function Column({ column }: ColumnProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDropzoneOver, setIsDropzoneOver] = useState(false);

  return (
    <div
      className={`group relative flex h-full min-h-0 w-full flex-col rounded-lg border transition-all duration-300 ease-out ${
        isDropzoneOver
          ? "border-ring/40 bg-accent/55 shadow-sm ring-2 ring-ring/30"
          : "border-border bg-muted/45 shadow-xs/5 hover:bg-muted/60 hover:shadow-sm"
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

      <div className="p-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0 [-webkit-overflow-scrolling:touch]">
        <ColumnDropzone column={column} onIsOverChange={setIsDropzoneOver} />
      </div>

      <div className="p-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="w-full text-left px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-md flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add task</span>
        </button>
      </div>
    </div>
  );
}

export default Column;
