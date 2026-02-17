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
      className={`group relative flex h-full min-h-0 w-full flex-col rounded-xl border transition-all duration-300 ease-out ${
        isDropzoneOver
          ? "border-ring/40 bg-accent/60 shadow-md ring-2 ring-ring/30"
          : "border-border/70 bg-muted/40 shadow-xs/5 hover:border-border/90 dark:bg-card/90"
      }`}
    >
      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        status={toKebabCase(column.name)}
      />

      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <ColumnHeader column={column} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 [-webkit-overflow-scrolling:touch]">
        <ColumnDropzone column={column} onIsOverChange={setIsDropzoneOver} />
      </div>

      <div className="border-t border-border/60 p-1.5 transition-opacity md:opacity-0 md:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground transition-all hover:bg-accent/50 hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
          <span>Add task</span>
        </button>
      </div>
    </div>
  );
}

export default Column;
