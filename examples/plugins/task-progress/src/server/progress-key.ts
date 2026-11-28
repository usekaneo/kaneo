export function projectPrefix(projectId: string): string {
  return `progress:${projectId}:`;
}

export function progressKey(projectId: string, taskId: string): string {
  return `${projectPrefix(projectId)}${taskId}`;
}
