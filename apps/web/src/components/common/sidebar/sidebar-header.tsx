import { useUserPreferencesStore } from '@/store/user-preferences';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo } from '../logo';

export const SidebarHeader = () => {
  const { isSidebarOpened, setIsSidebarOpened } = useUserPreferencesStore();

  return (
    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
      {isSidebarOpened ? <Logo /> : null}
      <button
        type="button"
        onClick={() => setIsSidebarOpened()}
        className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        {isSidebarOpened ? (
          <ChevronLeft className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        )}
      </button>
    </div>
  );
};
