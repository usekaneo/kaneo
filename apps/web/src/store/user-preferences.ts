import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type UserPreferencesStore = {
  isSidebarOpened: boolean;
  setIsSidebarOpened: () => void;
  viewMode: "board" | "list";
  setViewMode: (mode: "board" | "list") => void;
  theme: "light" | "dark" | "system";
  setTheme: (
    theme: "light" | "dark" | "system",
    coordinates?: { x: number; y: number },
  ) => void;
};

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    (set, get) => ({
      isSidebarOpened: true,
      setIsSidebarOpened: () =>
        set({ isSidebarOpened: !get().isSidebarOpened }),
      viewMode: "board",
      setViewMode: (mode) => set({ viewMode: mode }),
      theme: "dark",
      setTheme: (
        theme: "light" | "dark" | "system",
        coordinates?: { x: number; y: number },
      ) => {
        if (coordinates) {
          document.documentElement.style.setProperty(
            "--x",
            `${coordinates.x}%`,
          );
          document.documentElement.style.setProperty(
            "--y",
            `${coordinates.y}%`,
          );
        } else {
          document.documentElement.style.removeProperty("--x");
          document.documentElement.style.removeProperty("--y");
        }

        if ("startViewTransition" in document) {
          document.startViewTransition(() => {
            set({ theme });
          });
        } else {
          set({ theme });
        }
      },
    }),
    {
      name: "user-preferences",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
