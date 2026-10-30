export type TaskSelectionStore = {
  getState: () => {
    focusedTaskId: string | null;
    focusedTaskRowId?: string | null;
    selectedTaskIds: Set<string>;
    setFocusedTask: (taskId: string | null, rowId?: string | null) => void;
    toggleSelection: (taskId: string) => void;
    selectTasks: (taskIds: string[]) => void;
    clearSelection: () => void;
  };
};
