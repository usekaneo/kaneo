// Ids of the notes Kaneo posted to GitLab itself. The note webhook reports them
// as authored by the token's user, so there is nothing in the payload that marks
// them as ours -- the recorded id is what keeps them from coming back as a
// duplicate comment. Only the most recent ids matter, since an older note will
// have been delivered long ago.
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
