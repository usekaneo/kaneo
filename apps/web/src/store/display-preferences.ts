import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DisplayPreferences {
  showAssignee: boolean;
  showPriority: boolean;
  showDueDate: boolean;
  showLabels: boolean;
  showTaskNumbers: boolean;
}

interface DisplayPreferencesStore extends DisplayPreferences {
  toggleAssignee: () => void;
  togglePriority: () => void;
  toggleDueDate: () => void;
  toggleLabels: () => void;
  toggleTaskNumbers: () => void;
  resetToDefaults: () => void;
}

const defaultPreferences: DisplayPreferences = {
  showAssignee: true,
  showPriority: true,
  showDueDate: true,
  showLabels: true,
  showTaskNumbers: true,
};

export const useDisplayPreferencesStore = create<DisplayPreferencesStore>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      toggleAssignee: () =>
        set((state) => ({ showAssignee: !state.showAssignee })),
      togglePriority: () =>
        set((state) => ({ showPriority: !state.showPriority })),
      toggleDueDate: () =>
        set((state) => ({ showDueDate: !state.showDueDate })),
      toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
      toggleTaskNumbers: () =>
        set((state) => ({ showTaskNumbers: !state.showTaskNumbers })),
      resetToDefaults: () => set(defaultPreferences),
    }),
    {
      name: "display-preferences",
    },
  ),
);
