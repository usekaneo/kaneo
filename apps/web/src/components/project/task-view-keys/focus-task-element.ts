export function focusTaskElement(
  taskId: string,
  moveFocus: boolean,
  rowId?: string | null,
) {
  const element = document.querySelector<HTMLElement>(
    rowId
      ? `[data-task-id="${taskId}"][data-task-row-id="${rowId}"]`
      : `[data-task-id="${taskId}"]`,
  );
  if (!element) return;
  if (moveFocus) element.focus({ preventScroll: true });
  element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}
