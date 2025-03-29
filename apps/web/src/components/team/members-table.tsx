import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import { getStatusIcon, getStatusText } from "@/lib/status";
import type WorkspaceUser from "@/types/workspace-user";
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import DeleteTeamMemberModal from "./delete-team-member-modal";

function MembersTable({ users }: { users: WorkspaceUser[] }) {
  const { isOwner } = useWorkspacePermission();
  const [isRemoveMemberModalOpen, setIsRemoveMemberModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<WorkspaceUser | null>(
    null,
  );

  return (
    <>
      <table className="w-full table-auto min-w-[800px]">
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
            {isOwner && (
              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {users?.map((member) => (
            <tr
              key={member.userEmail}
              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
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
              {isOwner && (
                <td className="py-3 px-4">
                  {member.role === "owner" ? (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                      Workspace owner
                    </span>
                  ) : (
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                        >
                          <MoreHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          className="bg-white dark:bg-zinc-900 rounded-md shadow-md border border-zinc-200 dark:border-zinc-700 p-1 z-50"
                          sideOffset={5}
                          align="end"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsRemoveMemberModalOpen(true);
                              setSelectedMember(member);
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm rounded text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Remove member</span>
                          </button>
                          <Popover.Arrow className="fill-white dark:fill-zinc-900" />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {selectedMember && (
        <DeleteTeamMemberModal
          userEmail={selectedMember.userEmail}
          open={isRemoveMemberModalOpen}
          onClose={() => {
            setIsRemoveMemberModalOpen(false);
            setSelectedMember(null);
          }}
        />
      )}
    </>
  );
}

export default MembersTable;
