import { Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { HeaderIconButton } from "./header/header-icon-button";
import TaskShareDialog from "./task-share-dialog";

export default function TaskShareButton({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { canShareProjects, isCheckingPermissions } = useWorkspacePermission();
  const [open, setOpen] = useState(false);

  if (isCheckingPermissions || !canShareProjects()) return null;

  return (
    <>
      <HeaderIconButton
        label={t("tasks:share.action")}
        onClick={() => setOpen(true)}
      >
        <Share2 />
      </HeaderIconButton>
      <TaskShareDialog taskId={taskId} open={open} onOpenChange={setOpen} />
    </>
  );
}
