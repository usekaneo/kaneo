import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import type { ProjectWithTasks } from "@/types/project";

type ColumnFooterProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnFooter({ column }: ColumnFooterProps) {
  const { t } = useTranslation();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  return (
    <>
      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        status={column.id}
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 rounded-md flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4 text-muted-foreground" />
          <span>{t("tasks:kanban.addTask")}</span>
        </button>
      </div>
    </>
  );
}
