// Pure rules for a task's assignee set. task.userId is the primary assignee.

export const MAX_ASSIGNEES = 20;

export function normalizeAssigneeIds(
  ids: readonly (string | null | undefined)[],
): string[] {
  const result: string[] = [];
  for (const id of ids) {
    const trimmed = id?.trim();
    if (trimmed && !result.includes(trimmed)) result.push(trimmed);
  }
  return result;
}

// The primary stays put while it is still assigned; otherwise the first wins.
export function pickPrimaryAssignee(
  currentPrimary: string | null,
  ids: readonly string[],
): string | null {
  if (currentPrimary && ids.includes(currentPrimary)) return currentPrimary;
  return ids[0] ?? null;
}

export function diffAssigneeIds(
  before: readonly string[],
  after: readonly string[],
) {
  return {
    added: after.filter((id) => !before.includes(id)),
    removed: before.filter((id) => !after.includes(id)),
  };
}

// Older clients and integrations only know the single `userId`. Echoing back the
// current primary must not wipe the other assignees, so it means "unchanged".
export function resolveRequestedAssignees(
  input: { assigneeIds?: readonly string[] | null; userId?: string | null },
  current: { primary: string | null; ids: readonly string[] },
): string[] {
  if (input.assigneeIds != null) return normalizeAssigneeIds(input.assigneeIds);
  // Neither field sent (for example a title edit that does not touch
  // assignees): nothing to change. An explicit null or "" still unassigns.
  if (input.userId === undefined) return [...current.ids];
  const userId = input.userId?.trim() || null;
  // A stored primary can be missing while co-assignees remain (rows written
  // before a hand-over existed); the first assignee is what readers report.
  const primary = current.primary ?? current.ids[0] ?? null;
  if (userId && userId === primary) return [...current.ids];
  return userId ? [userId] : [];
}
