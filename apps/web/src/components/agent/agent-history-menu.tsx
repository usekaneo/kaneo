import { History } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import useAgentConversations from "@/hooks/queries/agent/use-agent-conversations";
import { formatRelativeTime } from "@/lib/format";

type AgentHistoryMenuProps = {
  workspaceId: string;
  projectId: string;
  activeId?: string;
  onSelect: (conversationId: string) => void;
};

export function AgentHistoryMenu({
  workspaceId,
  projectId,
  activeId,
  onSelect,
}: AgentHistoryMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data, isPending, isError } = useAgentConversations(
    workspaceId,
    projectId,
    open,
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label={t("agent:panel.history")}
          />
        }
      >
        <History aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
            {t("agent:panel.history")}
          </DropdownMenuLabel>
          {isPending ? (
            <DropdownMenuItem disabled className="text-sm">
              {t("common:empty.loading")}
            </DropdownMenuItem>
          ) : isError ? (
            <DropdownMenuItem disabled className="text-sm">
              {t("agent:panel.historyError")}
            </DropdownMenuItem>
          ) : data.length === 0 ? (
            <DropdownMenuItem disabled className="text-sm">
              {t("agent:panel.historyEmpty")}
            </DropdownMenuItem>
          ) : (
            data.map((conversation) => (
              <DropdownMenuItem
                key={conversation.id}
                disabled={conversation.id === activeId}
                onClick={() => onSelect(conversation.id)}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="truncate">{conversation.title}</span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {formatRelativeTime(conversation.updatedAt)}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
