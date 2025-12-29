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
): string {
  return issueBody || "";
}
