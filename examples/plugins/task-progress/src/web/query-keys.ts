const root = ["plugin", "task-progress"] as const;

export function projectProgressKey(projectId: string) {
  return [...root, "project", projectId] as const;
}

export function taskProgressKey(projectId: string, taskId: string) {
  return [...root, "task", projectId, taskId] as const;
}
