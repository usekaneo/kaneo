import { getStatusIcon, getStatusText } from "@/lib/status";
import type WorkspaceUser from "@/types/workspace-user";
import { Avatar, AvatarFallback } from "../ui/avatar";

type MembersTableProps = {
  users: WorkspaceUser[];
};

function MembersTable({ users }: MembersTableProps) {
  return (
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
            {/* TODO: Implement delete member */}
            {/* <td className="py-3 px-4">
              {member.role !== "owner" && isOwner && (
                <button
                  type="button"
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                  onClick={() => {
                    setIsRemoveMemberModalOpen(true);
                    setSelectedMember(member);
                  }}
                >
                  <MoreHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                </button>
              )}
            </td> */}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default MembersTable;
