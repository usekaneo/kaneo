import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type UserPreferencesStore = {
  isSidebarOpened: boolean;
  setIsSidebarOpened: () => void;
  viewMode: "board" | "list";
  setViewMode: (mode: "board" | "list") => void;
};

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    (set, get) => ({
      isSidebarOpened: true,
      setIsSidebarOpened: () =>
        set({ isSidebarOpened: !get().isSidebarOpened }),
      viewMode: "board",
      setViewMode: (mode) => set({ viewMode: mode }),
    }),
    {
      name: "user-preferences",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
