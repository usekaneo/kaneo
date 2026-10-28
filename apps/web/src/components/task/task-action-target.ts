export type TaskActionName =
  | "status"
  | "priority"
  | "assignee"
  | "labels"
  | "dueDate"
  | "move"
  | "title"
  | "description"
  | "comment"
  | "addLink"
  | "addSubtask"
  | "resources";

const FIELDS = [
  ".ProseMirror",
  "[contenteditable='true']",
  "textarea",
  "input:not([type='file']):not([type='hidden'])",
];

function findField(element: HTMLElement) {
  if (element.matches(FIELDS.join(", "))) return element;
  for (const selector of FIELDS) {
    const field = element.querySelector<HTMLElement>(selector);
    if (field) return field;
  }
  return element;
}

export function findTaskAction(name: TaskActionName) {
  const candidates = document.querySelectorAll<HTMLElement>(
    `[data-task-view] [data-task-action="${name}"]`,
  );
  return (
    [...candidates].find((element) => element.getClientRects().length > 0) ??
    null
  );
}

export function clickTaskAction(name: TaskActionName) {
  findTaskAction(name)?.click();
}

export function focusTaskAction(name: TaskActionName) {
  const element = findTaskAction(name);
  if (!element) return;
  const target = findField(element);
  target.focus();
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    target.select();
  } else if (target.isContentEditable) {
    window.getSelection()?.selectAllChildren(target);
    window.getSelection()?.collapseToEnd();
  }
}
