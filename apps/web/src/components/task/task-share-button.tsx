import { Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import TaskShareDialog from "./task-share-dialog";

export default function TaskShareButton({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { canShareProjects, isCheckingPermissions } = useWorkspacePermission();
  const [open, setOpen] = useState(false);

  if (isCheckingPermissions || !canShareProjects()) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={t("tasks:share.action")}
            className="text-foreground"
            onClick={() => setOpen(true)}
          >
            <Share2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("tasks:share.action")}</TooltipContent>
      </Tooltip>
      <TaskShareDialog taskId={taskId} open={open} onOpenChange={setOpen} />
    </>
  );
}
