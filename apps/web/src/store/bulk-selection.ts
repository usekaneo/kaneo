import { create } from "zustand";

interface BulkSelectionState {
  selectedTaskIds: Set<string>;
  isSelectMode: boolean;
  availableTaskIds: string[];
  selectionAnchorId: string | null;
  focusedTaskId: string | null;

  selectTask: (taskId: string) => void;
  deselectTask: (taskId: string) => void;
  toggleSelection: (taskId: string) => void;
  setSelectionAnchor: (taskId: string) => void;
  selectRange: (taskId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  setAvailableTasks: (taskIds: string[]) => void;
  getSelectedCount: () => number;
  isSelected: (taskId: string) => boolean;
  setFocusedTask: (taskId: string | null) => void;
  clearFocus: () => void;
  isFocused: (taskId: string) => boolean;
  focusNext: () => void;
  focusPrevious: () => void;
}

const useBulkSelectionStore = create<BulkSelectionState>((set, get) => ({
  selectedTaskIds: new Set(),
  isSelectMode: false,
  availableTaskIds: [],
  selectionAnchorId: null,
  focusedTaskId: null,

  selectTask: (taskId: string) =>
    set((state) => ({
      selectedTaskIds: new Set([...state.selectedTaskIds, taskId]),
      isSelectMode: true,
      selectionAnchorId: taskId,
    })),

  deselectTask: (taskId: string) =>
    set((state) => {
      const newSet = new Set(state.selectedTaskIds);
      newSet.delete(taskId);
      return {
        selectedTaskIds: newSet,
        isSelectMode: newSet.size > 0,
        selectionAnchorId: taskId,
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

  setSelectionAnchor: (taskId: string) => set({ selectionAnchorId: taskId }),

  selectRange: (taskId: string) =>
    set((state) => {
      const end = state.availableTaskIds.indexOf(taskId);
      const start = state.availableTaskIds.indexOf(
        state.selectionAnchorId ?? "",
      );
      const range =
        start < 0 || end < 0
          ? [taskId]
          : state.availableTaskIds.slice(
              Math.min(start, end),
              Math.max(start, end) + 1,
            );
      return {
        selectedTaskIds: new Set([...state.selectedTaskIds, ...range]),
        isSelectMode: true,
        selectionAnchorId:
          start < 0 || end < 0 ? taskId : state.selectionAnchorId,
      };
    }),

  clearSelection: () =>
    set({
      selectedTaskIds: new Set(),
      isSelectMode: false,
      selectionAnchorId: null,
    }),

  selectAll: () =>
    set((state) => ({
      selectedTaskIds: new Set(state.availableTaskIds),
      isSelectMode: true,
      selectionAnchorId: null,
    })),

  setAvailableTasks: (taskIds: string[]) =>
    set((state) => ({
      availableTaskIds: taskIds,
      selectionAnchorId: taskIds.includes(state.selectionAnchorId ?? "")
        ? state.selectionAnchorId
        : null,
    })),

  getSelectedCount: () => {
    const { selectedTaskIds } = get();
    return selectedTaskIds.size;
  },

  isSelected: (taskId: string) => {
    const { selectedTaskIds } = get();
    return selectedTaskIds.has(taskId);
  },

  setFocusedTask: (taskId: string | null) =>
    set(() => ({
      focusedTaskId: taskId,
    })),

  clearFocus: () =>
    set(() => ({
      focusedTaskId: null,
    })),

  isFocused: (taskId: string) => {
    const { focusedTaskId } = get();
    return focusedTaskId === taskId;
  },

  focusNext: () => {
    const { availableTaskIds, focusedTaskId } = get();

    if (availableTaskIds.length === 0) return;

    if (!focusedTaskId) {
      get().setFocusedTask(availableTaskIds[0]);
      return;
    }

    const currentIndex = availableTaskIds.indexOf(focusedTaskId);
    const nextIndex = (currentIndex + 1) % availableTaskIds.length;
    get().setFocusedTask(availableTaskIds[nextIndex]);
  },

  focusPrevious: () => {
    const { availableTaskIds, focusedTaskId } = get();

    if (availableTaskIds.length === 0) return;

    if (!focusedTaskId) {
      get().setFocusedTask(availableTaskIds[availableTaskIds.length - 1]);
      return;
    }

    const currentIndex = availableTaskIds.indexOf(focusedTaskId);
    const previousIndex =
      currentIndex === 0 ? availableTaskIds.length - 1 : currentIndex - 1;
    get().setFocusedTask(availableTaskIds[previousIndex]);
  },
}));

export default useBulkSelectionStore;
