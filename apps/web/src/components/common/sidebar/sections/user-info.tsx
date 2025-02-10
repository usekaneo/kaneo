import useAuth from '@/components/providers/auth-provider/hooks/use-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { useUserPreferencesStore } from '@/store/user-preferences';

const UserInfo = () => {
  const { user } = useAuth();
  const { isSidebarOpened } = useUserPreferencesStore();

  return (
    <div className="flex items-center gap-3 mb-3">
      <Avatar className="text-zinc-900 dark:text-zinc-100">
        <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className={cn('flex-1 min-w-0', !isSidebarOpened && 'hidden')}>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {user?.name}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {user?.email}
        </p>
      </div>
    </div>
  );
};

export default UserInfo;
