import { Code } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useAgentCodeRepositories from "@/hooks/queries/agent/use-agent-code-repositories";
import useAgentCodeStatus from "@/hooks/queries/agent/use-agent-code-status";
import { getAgentCodeAvailability } from "./get-agent-code-availability";
import { TaskAgentCodeDialog } from "./task-agent-code-dialog";

type TaskAgentCodeButtonProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
};

const buttonClassName =
  "text-muted-foreground hover:text-foreground [&_svg]:size-[15px]";

export function TaskAgentCodeButton({
  taskId,
  projectId,
  workspaceId,
}: TaskAgentCodeButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: status } = useAgentCodeStatus(workspaceId);
  // Listing repositories checks GitHub, so skip it for users who can't code.
  const { data: repositories } = useAgentCodeRepositories(
    status?.canRunCode ? workspaceId : "",
  );
  const availability = getAgentCodeAvailability(
    status,
    repositories,
    projectId,
  );
  const label = t("agent:code.start.action");

  if (availability.state === "hidden") return null;

  if (availability.state === "unavailable")
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            // aria-disabled keeps the button focusable so the reason shows.
            <Button
              variant="ghost"
              size="sm"
              aria-disabled="true"
              className={`${buttonClassName} cursor-not-allowed opacity-64 hover:bg-transparent hover:text-muted-foreground`}
            />
          }
        >
          <Code aria-hidden="true" />
          <span className="max-sm:sr-only">{label}</span>
        </TooltipTrigger>
        <TooltipContent>{t("agent:code.start.noRepository")}</TooltipContent>
      </Tooltip>
    );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={buttonClassName}
        onClick={() => setOpen(true)}
      >
        <Code aria-hidden="true" />
        <span className="max-sm:sr-only">{label}</span>
      </Button>
      <TaskAgentCodeDialog
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        taskId={taskId}
        repositories={availability.repositories}
      />
    </>
  );
}
