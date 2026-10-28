// Archived tasks take no part in open/closed issue sync in either direction.
// Unarchiving lets the status handlers bring the issue back in line.
export function isStateSyncPaused(status: string) {
  return status === "archived";
}
