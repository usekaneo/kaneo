import { Plus } from "lucide-react";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export default function TaskViewContextMenu({
  projectId,
  disabled = false,
  children,
}: {
  projectId: string;
  disabled?: boolean;
  children: ReactElement;
}) {
  const { t } = useTranslation();
  const { canCreateTasks } = useWorkspacePermission();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<string>();
  const canOfferCreation = !disabled && canCreateTasks();

  return (
    <>
      <ContextMenu
        open={canOfferCreation && menuOpen}
        onOpenChange={(nextOpen) => setMenuOpen(canOfferCreation && nextOpen)}
      >
        <ContextMenuTrigger
          asChild
          onContextMenu={(event) => {
            const target = event.target;
            setStatus(
              target instanceof Element
                ? target.closest<HTMLElement>("[data-task-status]")?.dataset
                    .taskStatus
                : undefined,
            );
          }}
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={!canOfferCreation}
            onClick={() => setOpen(true)}
          >
            <Plus />
            {t("tasks:calendar.newTask")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {open && (
        <CreateTaskModal
          open
          onClose={() => setOpen(false)}
          projectId={projectId}
          status={status}
        />
      )}
    </>
  );
}
