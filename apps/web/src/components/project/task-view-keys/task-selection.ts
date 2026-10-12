export type TaskSelectionStore = {
  getState: () => {
    focusedTaskId: string | null;
    selectedTaskIds: Set<string>;
    setFocusedTask: (taskId: string | null) => void;
    toggleSelection: (taskId: string) => void;
    selectTasks: (taskIds: string[]) => void;
    clearSelection: () => void;
  };
};
