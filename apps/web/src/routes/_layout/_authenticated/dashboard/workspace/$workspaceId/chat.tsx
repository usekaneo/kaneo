import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChatPanel } from "@/components/chat/chat-panel";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";

type Search = { c?: string };

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/chat",
)({
  validateSearch: (search: Record<string, unknown>): Search => ({
    c: typeof search.c === "string" && search.c ? search.c : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <>
      <PageTitle title={t("chat:title")} />
      <WorkspaceLayout title={t("chat:title")}>
        {/* The layout grows with its content, so without a fixed height the
            composer would scroll off below the conversation. Viewport minus
            the inset's margins and the page header. */}
        <div className="h-[calc(100svh-3.5rem-2px)]">
          <ChatPanel
            variant="page"
            workspaceId={workspaceId}
            activeId={c ?? null}
            onSelect={(id) => navigate({ search: id ? { c: id } : {} })}
          />
        </div>
      </WorkspaceLayout>
    </>
  );
}
