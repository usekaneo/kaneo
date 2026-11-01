import { Share2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useSetAgentConversationSharing from "@/hooks/mutations/agent/use-set-agent-conversation-sharing";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { getAgentErrorKey } from "./get-agent-error-key";
import { useAgentConversationAccess } from "./use-agent-conversation-access";

type AgentShareButtonProps = {
  workspaceId: string;
  conversationId: string;
};

export function AgentShareButton({
  workspaceId,
  conversationId,
}: AgentShareButtonProps) {
  const { t } = useTranslation();
  const { conversation, isOwner } = useAgentConversationAccess(
    workspaceId,
    conversationId,
  );
  const sharing = useSetAgentConversationSharing(workspaceId, conversationId);

  if (!conversation || !isOwner) return null;

  const shared = Boolean(conversation.sharedAt);
  const label = t(shared ? "agent:sharing.stop" : "agent:sharing.share");
  const Icon = shared ? Users : Share2;

  const handleClick = () =>
    sharing.mutate(!shared, {
      onSuccess: () =>
        toast.success(
          t(
            shared ? "agent:sharing.stoppedToast" : "agent:sharing.sharedToast",
          ),
        ),
      onError: (error) => toast.error(t(getAgentErrorKey(error))),
    });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-7 text-muted-foreground",
              shared && "text-info-foreground",
            )}
            aria-label={label}
            disabled={sharing.isPending}
            onClick={handleClick}
          >
            <Icon aria-hidden="true" className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
