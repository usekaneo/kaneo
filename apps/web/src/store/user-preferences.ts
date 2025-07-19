import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type UserPreferencesStore = {
  // Theme preferences
  theme: "light" | "dark" | "system";
  setTheme: (
    theme: "light" | "dark" | "system",
    coordinates?: { x: number; y: number },
  ) => void;

  // View preferences
  viewMode: "board" | "list";
  setViewMode: (mode: "board" | "list") => void;

  // Layout preferences
  compactMode: boolean;
  setCompactMode: (compact: boolean) => void;

  // Display preferences
  showTaskNumbers: boolean;
  setShowTaskNumbers: (show: boolean) => void;
  showAssignees: boolean;
  setShowAssignees: (show: boolean) => void;
  showDueDates: boolean;
  setShowDueDates: (show: boolean) => void;
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  showPriority: boolean;
  setShowPriority: (show: boolean) => void;

  // Sidebar preferences (for initial state)
  sidebarDefaultOpen: boolean;
  setSidebarDefaultOpen: (open: boolean) => void;

  // Workspace tracking
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (workspaceId: string | null) => void;

  // Legacy - keeping for backward compatibility
  isSidebarOpened: boolean;
  setIsSidebarOpened: () => void;
};

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    (set, get) => ({
      // Theme
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

      // View preferences
      viewMode: "board",
      setViewMode: (mode) => set({ viewMode: mode }),

      // Layout preferences
      compactMode: false,
      setCompactMode: (compact) => set({ compactMode: compact }),

      // Display preferences
      showTaskNumbers: true,
      setShowTaskNumbers: (show) => set({ showTaskNumbers: show }),
      showAssignees: true,
      setShowAssignees: (show) => set({ showAssignees: show }),
      showDueDates: true,
      setShowDueDates: (show) => set({ showDueDates: show }),
      showLabels: true,
      setShowLabels: (show) => set({ showLabels: show }),
      showPriority: true,
      setShowPriority: (show) => set({ showPriority: show }),

      // Sidebar preferences
      sidebarDefaultOpen: true,
      setSidebarDefaultOpen: (open) => set({ sidebarDefaultOpen: open }),

      // Workspace tracking
      activeWorkspaceId: null,
      setActiveWorkspaceId: (workspaceId) =>
        set({ activeWorkspaceId: workspaceId }),

      // Legacy - keeping for backward compatibility
      isSidebarOpened: true,
      setIsSidebarOpened: () =>
        set({ isSidebarOpened: !get().isSidebarOpened }),
    }),
    {
      name: "user-preferences",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
