import { useEffect } from "react";

type FocusStore = { getState: () => { focusedTaskId: string | null } };

export function useRestoreTaskFocus(taskId: string, store: FocusStore) {
  useEffect(() => {
    if (store.getState().focusedTaskId !== taskId) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const element = document.querySelector<HTMLElement>(
      `[data-task-id="${taskId}"]`,
    );
    element?.focus({ preventScroll: true });
    element?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [taskId, store]);
}
