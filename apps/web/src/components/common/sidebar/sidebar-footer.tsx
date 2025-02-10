import { cn } from '@/lib/cn';
import { useUserPreferencesStore } from '@/store/user-preferences';
import BottomActions from './sections/bottom-actions';
import UserInfo from './sections/user-info';

const SidebarFooter = () => {
  const { isSidebarOpened } = useUserPreferencesStore();

  return (
    <div
      className={cn(
        'border-t border-zinc-200 dark:border-zinc-800',
        !isSidebarOpened ? 'p-2' : 'p-4',
      )}
    >
      <UserInfo />
      <BottomActions />
    </div>
  );
};

export default SidebarFooter;
