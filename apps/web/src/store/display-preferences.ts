import { useUserPreferencesStore } from "./user-preferences";

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

// This is now a wrapper around the user preferences store
export const useDisplayPreferencesStore = (): DisplayPreferencesStore => {
  const {
    showAssignees,
    setShowAssignees,
    showDueDates,
    setShowDueDates,
    showLabels,
    setShowLabels,
    showTaskNumbers,
    setShowTaskNumbers,
    showPriority,
    setShowPriority,
  } = useUserPreferencesStore();

  return {
    // Map the user preferences to the display preferences API
    showAssignee: showAssignees,
    showPriority: showPriority,
    showDueDate: showDueDates,
    showLabels: showLabels,
    showTaskNumbers: showTaskNumbers,

    // Toggle functions that update the user preferences
    toggleAssignee: () => setShowAssignees(!showAssignees),
    togglePriority: () => setShowPriority(!showPriority),
    toggleDueDate: () => setShowDueDates(!showDueDates),
    toggleLabels: () => setShowLabels(!showLabels),
    toggleTaskNumbers: () => setShowTaskNumbers(!showTaskNumbers),

    resetToDefaults: () => {
      setShowAssignees(true);
      setShowDueDates(true);
      setShowLabels(true);
      setShowTaskNumbers(true);
      setShowPriority(true);
    },
  };
};
