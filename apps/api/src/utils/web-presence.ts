// Who has Kaneo open right now, per workspace: every open workspace page
// keeps the chat event stream connected, so an open stream means online.
// Kept in memory, which is exact for a single API instance. With several
// instances behind Redis each only knows its own streams.
const open = new Map<string, Map<string, number>>();

/** Marks the user online in the workspace until the returned fn is called. */
export function markWebPresence(workspaceId: string, userId: string) {
  let users = open.get(workspaceId);
  if (!users) {
    users = new Map();
    open.set(workspaceId, users);
  }
  users.set(userId, (users.get(userId) ?? 0) + 1);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = open.get(workspaceId);
    const count = (current?.get(userId) ?? 0) - 1;
    if (!current) return;
    if (count > 0) current.set(userId, count);
    else current.delete(userId);
    if (current.size === 0) open.delete(workspaceId);
  };
}

export function webPresentUserIds(workspaceId: string) {
  return new Set(open.get(workspaceId)?.keys() ?? []);
}
