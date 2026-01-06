import { create } from "zustand";

interface BacklogBulkSelectionState {
  selectedTaskIds: Set<string>;
  isSelectMode: boolean;
  availableTaskIds: string[];

  selectTask: (taskId: string) => void;
  deselectTask: (taskId: string) => void;
  toggleSelection: (taskId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  setAvailableTasks: (taskIds: string[]) => void;
  getSelectedCount: () => number;
  isSelected: (taskId: string) => boolean;
}

const useBacklogBulkSelectionStore = create<BacklogBulkSelectionState>(
  (set, get) => ({
    selectedTaskIds: new Set(),
    isSelectMode: false,
    availableTaskIds: [],

    selectTask: (taskId: string) =>
      set((state) => ({
        selectedTaskIds: new Set([...state.selectedTaskIds, taskId]),
        isSelectMode: true,
      })),

    deselectTask: (taskId: string) =>
      set((state) => {
        const newSet = new Set(state.selectedTaskIds);
        newSet.delete(taskId);
        return {
          selectedTaskIds: newSet,
          isSelectMode: newSet.size > 0,
        };
      }),

    toggleSelection: (taskId: string) => {
      const { selectedTaskIds } = get();
      if (selectedTaskIds.has(taskId)) {
        get().deselectTask(taskId);
      } else {
        get().selectTask(taskId);
      }
    },

    clearSelection: () =>
      set({
        selectedTaskIds: new Set(),
        isSelectMode: false,
      }),

    selectAll: () =>
      set((state) => ({
        selectedTaskIds: new Set(state.availableTaskIds),
        isSelectMode: true,
      })),

    setAvailableTasks: (taskIds: string[]) =>
      set(() => ({
        availableTaskIds: taskIds,
      })),

    getSelectedCount: () => {
      const { selectedTaskIds } = get();
      return selectedTaskIds.size;
    },

    isSelected: (taskId: string) => {
      const { selectedTaskIds } = get();
      return selectedTaskIds.has(taskId);
    },
  }),
);

export default useBacklogBulkSelectionStore;
