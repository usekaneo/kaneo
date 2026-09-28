// Kaneo's own notes come back authored by the token user; match them by id.
const MAX_TRACKED_NOTE_IDS = 50;

export function syncedNoteIds(metadata: string | null | undefined): number[] {
  if (!metadata) return [];

  try {
    const parsed = JSON.parse(metadata) as { syncedNoteIds?: unknown };
    if (!Array.isArray(parsed.syncedNoteIds)) return [];
    return parsed.syncedNoteIds.filter(
      (id): id is number => typeof id === "number",
    );
  } catch {
    return [];
  }
}

export function withSyncedNoteId(existing: number[], noteId: number): number[] {
  return [...existing, noteId].slice(-MAX_TRACKED_NOTE_IDS);
}
