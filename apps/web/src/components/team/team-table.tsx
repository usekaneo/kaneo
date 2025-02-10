import useGetWorkspaceUsers from '@/hooks/queries/workspace-users/use-get-workspace-users';
import { Route } from '@/routes/dashboard/workspace/$workspaceId';
import { MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';

const TeamTable = () => {
  const { workspaceId } = Route.useParams();
  const { data: users } = useGetWorkspaceUsers({ workspaceId });

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-zinc-200 dark:border-zinc-800">
          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Name
          </th>
          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Role
          </th>
          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Joined
          </th>
        </tr>
      </thead>
      <tbody>
        {users?.map((user) => (
          <tr
            key={user.userName}
            className="border-b border-zinc-200 dark:border-zinc-800 last:border-0"
          >
            <td className="py-3 px-4">
              <div className="flex items-center">
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarFallback>{user.userName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {user.userName}
                  </div>
                </div>
              </div>
            </td>
            <td className="py-3 px-4">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                Admin
              </span>
            </td>
            <td className="py-3 px-4 text-sm text-zinc-500 dark:text-zinc-400">
              {new Date(user.joinedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </td>
            <td className="py-3 px-4">
              <button
                type="button"
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
              >
                <MoreHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default TeamTable;
