import { cn } from '@/lib/cn';
import { useUserPreferencesStore } from '@/store/user-preferences';
import { SidebarContent } from './sidebar-content';
import SidebarFooter from './sidebar-footer';
import { SidebarHeader } from './sidebar-header';

export const Sidebar = () => {
  const { isSidebarOpened } = useUserPreferencesStore();

  return (
    <div
      className={cn(
        'flex bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-screen flex-col',
        'transition-all duration-300 ease-in-out',
        'min-h-screen',
        !isSidebarOpened ? 'w-16' : 'w-64',
      )}
    >
      <SidebarHeader />
      <SidebarContent />
      <SidebarFooter />
    </div>
  );
};
