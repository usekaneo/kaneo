type TaskScopedLabel = {
  name: string;
  taskId: string | null;
};

export function getTaskLabelOptions<T extends TaskScopedLabel>(
  labels: T[],
  taskId: string,
) {
  const labelMap = new Map<string, T>();

  for (const label of labels) {
    if (label.taskId !== null && label.taskId !== taskId) continue;

    const existing = labelMap.get(label.name);
    if (!existing || (label.taskId === null && existing.taskId !== null)) {
      labelMap.set(label.name, label);
    }
  }

  return Array.from(labelMap.values());
}
