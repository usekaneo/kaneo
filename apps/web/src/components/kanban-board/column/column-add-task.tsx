import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import useProjectStore from "@/store/project";

type ColumnAddTaskProps = {
  columnId: string;
};

export function ColumnAddTask({ columnId }: ColumnAddTaskProps) {
  const { t } = useTranslation();
  const { project } = useProjectStore();
  const { canCreateTasks } = useWorkspacePermission();
  const [isOpen, setIsOpen] = useState(false);

  if (!canCreateTasks()) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-1 flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus aria-hidden="true" className="size-3.5" />
        {t("tasks:kanban.addTask")}
      </button>

      <CreateTaskModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        projectId={project?.id}
        status={columnId}
      />
    </>
  );
}
