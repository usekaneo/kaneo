import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import MembersTable from "@/components/team/members-table";
import { Button } from "@/components/ui/button";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute(
  "/dashboard/teams/$workspaceId/_layout/members",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const { data: users } = useGetWorkspaceUsers({ workspaceId });
  const [isInviteTeamMemberModalOpen, setIsInviteTeamMemberModalOpen] =
    useState(false);

  return (
    <motion.div
      className="flex-1 p-4 md:p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Team Members
        </h1>

        <Button
          onClick={() => setIsInviteTeamMemberModalOpen(true)}
          className="bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 w-full md:w-auto"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          New Invitation
        </Button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <MembersTable users={users ?? []} />

          {users?.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                No team members found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TODO: Implement delete member */}
      {/* <DeleteTeamMemberModal
        userEmail={selectedMember?.userEmail ?? ""}
        open={isRemoveMemberModalOpen}
        onClose={() => setIsRemoveMemberModalOpen(false)}
      /> */}

      <InviteTeamMemberModal
        open={isInviteTeamMemberModalOpen}
        onClose={() => setIsInviteTeamMemberModalOpen(false)}
      />
    </motion.div>
  );
}
