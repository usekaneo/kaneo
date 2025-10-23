import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import MembersTable from "@/components/team/members-table";
import { Button } from "@/components/ui/button";
import useGetFullWorkspace from "@/hooks/queries/workspace/use-get-full-workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/members",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const { data: workspace } = useGetFullWorkspace({ workspaceId });

  const [isInviteTeamMemberModalOpen, setIsInviteTeamMemberModalOpen] =
    useState(false);

  const users = workspace?.members;
  const userInvitations = workspace?.invitations;

  return (
    <>
      <PageTitle title="Members" />
      <WorkspaceLayout
        title="Members"
        headerActions={
          <Button
            onClick={() => setIsInviteTeamMemberModalOpen(true)}
            variant="outline"
            size="xs"
            className="gap-1 w-full md:w-auto"
          >
            <UserPlus className="w-3 h-3" />
            Invite member
          </Button>
        }
      >
        <MembersTable users={users ?? []} invitations={userInvitations ?? []} />

        <InviteTeamMemberModal
          open={isInviteTeamMemberModalOpen}
          onClose={() => setIsInviteTeamMemberModalOpen(false)}
        />
      </WorkspaceLayout>
    </>
  );
}
