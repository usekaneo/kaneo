import DeleteTeamMemberModal from "@/components/team/delete-team-member-modal";
import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, MoreHorizontal, UserPlus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute(
  "/dashboard/teams/$workspaceId/_layout/members",
)({
  component: RouteComponent,
});

const getStatusIcon = (status: "active" | "pending") => {
  switch (status) {
    case "active":
      return (
        <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
      );
    case "pending":
      return <Clock className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />;
  }
};

const getStatusText = (status: "active" | "pending") =>
  ({
    active: "Active",
    pending: "Pending",
  })[status];

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const { data: users } = useGetWorkspaceUsers({ workspaceId });
  const [isInviteTeamMemberModalOpen, setIsInviteTeamMemberModalOpen] =
    useState(false);
  const [isRemoveMemberModalOpen, setIsRemoveMemberModalOpen] = useState(false);

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
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Email
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Role
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Status
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Date
              </th>
              <th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {users?.map((member) => (
              <tr
                key={member.userEmail}
                className="border-b border-zinc-200 dark:border-zinc-800 last:border-0"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8 mr-3">
                      <AvatarFallback className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                        {member.userEmail.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-zinc-900 dark:text-zinc-100">
                      {member.userEmail}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                    {member.role.charAt(0).toUpperCase() +
                      member.role.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(member.status as "active" | "pending")}
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {getStatusText(member.status as "active" | "pending")}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {member.joinedAt &&
                    new Date(member.joinedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                </td>
                <td className="py-3 px-4">
                  <button
                    type="button"
                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                    onClick={() => setIsRemoveMemberModalOpen(true)}
                  >
                    <MoreHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users?.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              No team members found
            </p>
          </div>
        )}
      </div>
      <DeleteTeamMemberModal
        userEmail={member.userEmail}
        open={isRemoveMemberModalOpen}
        onClose={() => setIsRemoveMemberModalOpen(false)}
      />

      <InviteTeamMemberModal
        open={isInviteTeamMemberModalOpen}
        onClose={() => setIsInviteTeamMemberModalOpen(false)}
      />
    </motion.div>
  );
}
