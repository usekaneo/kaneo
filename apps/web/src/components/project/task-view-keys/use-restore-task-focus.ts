import { useEffect } from "react";

type FocusStore = {
  getState: () => {
    focusedTaskId: string | null;
    focusedTaskRowId?: string | null;
  };
};

export function useRestoreTaskFocus(
  taskId: string,
  store: FocusStore,
  rowId?: string,
) {
  useEffect(() => {
    const state = store.getState();
    if (state.focusedTaskId !== taskId) return;
    if (rowId && state.focusedTaskRowId && state.focusedTaskRowId !== rowId)
      return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const element = document.querySelector<HTMLElement>(
      rowId && state.focusedTaskRowId
        ? `[data-task-id="${taskId}"][data-task-row-id="${rowId}"]`
        : `[data-task-id="${taskId}"]`,
    );
    element?.focus({ preventScroll: true });
    element?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [taskId, store, rowId]);
}
