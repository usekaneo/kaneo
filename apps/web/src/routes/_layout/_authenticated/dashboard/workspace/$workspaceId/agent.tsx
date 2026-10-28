import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentConversationView } from "@/components/agent/agent-conversation-view";
import { AgentHome } from "@/components/agent/agent-home";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import useAgentConfig from "@/hooks/queries/agent/use-agent-config";

type AgentSearchParams = {
  conversationId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/agent",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): AgentSearchParams => ({
    conversationId:
      typeof search.conversationId === "string"
        ? search.conversationId
        : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { conversationId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: config } = useAgentConfig(workspaceId);
  const enabled = config?.enabled === true;

  return (
    <>
      <PageTitle title={t("agent:title")} />
      <WorkspaceLayout
        title={t("agent:title")}
        headerActions={
          conversationId ? (
            <Button
              variant="ghost"
              size="xs"
              className="h-7 gap-1.5 text-xs"
              onClick={() => void navigate({ search: {} })}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              {t("agent:panel.newConversation")}
            </Button>
          ) : null
        }
      >
        {conversationId ? (
          <AgentConversationView
            key={conversationId}
            workspaceId={workspaceId}
            conversationId={conversationId}
            enabled={enabled}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <AgentHome
              workspaceId={workspaceId}
              enabled={enabled}
              onOpenConversation={(id) =>
                void navigate({ search: { conversationId: id } })
              }
            />
          </div>
        )}
      </WorkspaceLayout>
    </>
  );
}
