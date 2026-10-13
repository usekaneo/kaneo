export function focusTaskElement(taskId: string, moveFocus: boolean) {
  const element = document.querySelector<HTMLElement>(
    `[data-task-id="${taskId}"]`,
  );
  if (!element) return;
  if (moveFocus) element.focus({ preventScroll: true });
  element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}
