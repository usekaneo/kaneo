import type { AgentSnapshot } from "./types";

export function taskSnapshot(
  task: Omit<AgentSnapshot, "dueDate"> & { dueDate: Date | null },
): AgentSnapshot {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    userId: task.userId,
    dueDate: task.dueDate?.toISOString() ?? null,
  };
}

export function matchesSnapshot(
  current: AgentSnapshot,
  expected: AgentSnapshot,
  fields: string[],
) {
  return (
    current.projectId === expected.projectId &&
    fields.every(
      (field) =>
        current[field as keyof AgentSnapshot] ===
        expected[field as keyof AgentSnapshot],
    )
  );
}
