import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type UserPreferncesStore = {
  isSidebarOpened: boolean;
  setIsSidebarOpened: () => void;
};

export const useUserPreferencesStore = create<UserPreferncesStore>()(
  persist(
    (set, get) => ({
      isSidebarOpened: true,
      setIsSidebarOpened: () => {
        set({ isSidebarOpened: !get().isSidebarOpened });
      },
    }),
    {
      name: 'user-preferences',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
