export function formatIssueTitle(taskTitle: string): string {
  return taskTitle;
}

export function formatIssueBody(
  taskDescription: string | null,
  taskId: string,
): string {
  const description = taskDescription || "";

  if (!description.trim()) {
    return `<sub>Task: ${taskId}</sub>`;
  }

  return `${description}

---
<sub>Task: ${taskId}</sub>`;
}

export function formatSyncComment(taskId: string): string {
  return `Task: ${taskId}`;
}

export function getLabelsForIssue(
  priority: string | null,
  status: string,
): string[] {
  const labels: string[] = [];

  if (priority && priority !== "no-priority") {
    labels.push(`priority:${priority}`);
  }

  labels.push(`status:${status}`);

  return labels;
}

export function formatTaskDescriptionFromIssue(
  issueBody: string | null,
  taskId?: string,
): string {
  const body = issueBody || "";
  // Only remove our exact trailing footer for the already-linked task.
  // New imports and arbitrary Task mentions remain untouched.
  if (!taskId) return body;
  const footer = `<sub>Task: ${taskId}</sub>`;
  if (body === footer) return "";
  const suffix = `\n\n---\n${footer}`;
  return body.endsWith(suffix) ? body.slice(0, -suffix.length) : body;
}
