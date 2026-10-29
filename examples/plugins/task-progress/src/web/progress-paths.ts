export function projectProgressPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/progress`;
}

export function taskProgressPath(projectId: string, taskId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/progress`;
}
