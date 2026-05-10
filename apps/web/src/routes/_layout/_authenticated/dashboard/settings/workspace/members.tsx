import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import MembersTable from "@/components/team/members-table";
import useGetFullWorkspace from "@/hooks/queries/workspace/use-get-full-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/members",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace } = useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const { data: fullWorkspace } = useGetFullWorkspace({ workspaceId });
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const users = fullWorkspace?.members ?? [];
  const invitations = fullWorkspace?.invitations ?? [];

  return (
    <>
      <PageTitle
        title={t("settings:workspaceMembers.pageTitle", {
          defaultValue: "Members",
        })}
      />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:workspaceMembers.title", { defaultValue: "Members" })}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:workspaceMembers.subtitle", {
              defaultValue:
                "People with access to {{workspace}} and pending invitations.",
              workspace: workspace?.name ?? "this workspace",
            })}
          </p>
        </div>

        <MembersTable
          workspaceId={workspaceId}
          users={users}
          invitations={invitations}
          onInvite={() => setIsInviteOpen(true)}
        />

        <InviteTeamMemberModal
          open={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
        />
      </div>
    </>
  );
}
