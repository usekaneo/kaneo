import type Task from "@/types/task";

// Boards never carry descriptions over 64 KB; the task view loads them.
const MAX_BOARD_DESCRIPTION_BYTES = 64 * 1024;

export function boundBoardDescription(
  patch: Partial<Task> | undefined,
): Partial<Task> | undefined {
  if (!patch || !("description" in patch)) return patch;
  const deferred =
    new TextEncoder().encode(patch.description ?? "").byteLength >
    MAX_BOARD_DESCRIPTION_BYTES;
  return {
    ...patch,
    description: deferred ? null : patch.description,
    descriptionDeferred: patch.descriptionDeferred ?? deferred,
  };
}
