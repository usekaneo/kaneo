import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

type TaskDeleteButtonProps = {
  handle: AlertDialogPrimitive.Handle<unknown>;
};

export default function TaskDeleteButton({ handle }: TaskDeleteButtonProps) {
  const { t } = useTranslation();
  const { canDeleteTasks, isCheckingPermissions } = useWorkspacePermission();

  if (isCheckingPermissions || !canDeleteTasks()) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertDialogTrigger
          handle={handle}
          render={
            <Button
              variant="outline"
              size="sm"
              aria-label={t("tasks:delete.action")}
              className="text-foreground hover:text-destructive-foreground"
            />
          }
        >
          <Trash2 className="size-4" />
        </AlertDialogTrigger>
      </TooltipTrigger>
      <TooltipContent>
        <span className="flex items-center gap-2">
          {t("tasks:delete.action")}
          <KbdSequence keys={[shortcuts.deleteTask.prefix, "⌫"]} separator="" />
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
