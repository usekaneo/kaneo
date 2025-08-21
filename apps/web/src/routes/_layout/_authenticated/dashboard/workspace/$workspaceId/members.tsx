import WorkspaceLayout from "@/components/common/workspace-layout";
import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import MembersTable from "@/components/team/members-table";
import { Button } from "@/components/ui/button";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/members",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const { data: users } = useGetWorkspaceUsers({ workspaceId });
  const [isInviteTeamMemberModalOpen, setIsInviteTeamMemberModalOpen] =
    useState(false);

  return (
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
      <MembersTable users={users ?? []} />

      <InviteTeamMemberModal
        open={isInviteTeamMemberModalOpen}
        onClose={() => setIsInviteTeamMemberModalOpen(false)}
      />
    </WorkspaceLayout>
  );
}
