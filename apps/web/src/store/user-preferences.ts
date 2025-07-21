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
  toggleTaskNumbers: () => void;
  showAssignees: boolean;
  setShowAssignees: (show: boolean) => void;
  toggleAssignees: () => void;
  showDueDates: boolean;
  setShowDueDates: (show: boolean) => void;
  toggleDueDates: () => void;
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  toggleLabels: () => void;
  showPriority: boolean;
  setShowPriority: (show: boolean) => void;
  togglePriority: () => void;
  resetDisplayPreferences: () => void;

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
      toggleTaskNumbers: () =>
        set((state) => ({ showTaskNumbers: !state.showTaskNumbers })),
      showAssignees: true,
      setShowAssignees: (show) => set({ showAssignees: show }),
      toggleAssignees: () =>
        set((state) => ({ showAssignees: !state.showAssignees })),
      showDueDates: true,
      setShowDueDates: (show) => set({ showDueDates: show }),
      toggleDueDates: () =>
        set((state) => ({ showDueDates: !state.showDueDates })),
      showLabels: true,
      setShowLabels: (show) => set({ showLabels: show }),
      toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
      showPriority: true,
      setShowPriority: (show) => set({ showPriority: show }),
      togglePriority: () =>
        set((state) => ({ showPriority: !state.showPriority })),
      resetDisplayPreferences: () =>
        set({
          showAssignees: true,
          showDueDates: true,
          showLabels: true,
          showTaskNumbers: true,
          showPriority: true,
        }),

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
