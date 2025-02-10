import { cn } from '@/lib/cn';
import { Route } from '@/routes/dashboard/workspace/$workspaceId';
import { useUserPreferencesStore } from '@/store/user-preferences';
import { useNavigate } from '@tanstack/react-router';
import { Users } from 'lucide-react';

const ManageTeams = () => {
  const { isSidebarOpened } = useUserPreferencesStore();
  const navigate = useNavigate();
  const { workspaceId } = Route.useParams();

  return (
    <div>
      <h2
        className={cn(
          'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2',
          isSidebarOpened && 'px-3',
        )}
      >
        {isSidebarOpened ? 'Team' : null}
      </h2>
      <button
        type="button"
        className={cn(
          'w-full text-left py-2 rounded-md flex items-center text-sm transition-all group',
          isSidebarOpened && 'px-3',
          !isSidebarOpened && 'justify-center px-2',
          'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800',
        )}
        title={!isSidebarOpened ? 'Manage Team' : undefined}
        onClick={() =>
          navigate({
            to: '/dashboard/workspace/$workspaceId/team',
            params: {
              workspaceId,
            },
          })
        }
      >
        <Users
          className={cn(
            'shrink-0',
            !isSidebarOpened ? 'w-6 h-6' : 'w-4 h-4 mr-2',
          )}
        />
        {isSidebarOpened ? 'Manage Team' : null}
      </button>
    </div>
  );
};

export default ManageTeams;
