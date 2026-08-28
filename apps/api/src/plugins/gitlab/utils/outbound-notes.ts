/**
 * Ids of notes Kaneo posted itself, kept on the issue link so the matching note
 * webhook can be recognised as an echo rather than a new comment. Bounded
 * because the list is rewritten on every outbound comment.
 */
const MAX_REMEMBERED_NOTE_IDS = 50;

const KEY = "outboundNoteIds";

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readIds(metadata: Record<string, unknown>): number[] {
  const value = metadata[KEY];
  return Array.isArray(value)
    ? value.filter((id): id is number => typeof id === "number")
    : [];
}

export function rememberOutboundNoteId(
  rawMetadata: string | null,
  noteId: number,
): Record<string, unknown> {
  const metadata = parseMetadata(rawMetadata);
  const ids = readIds(metadata).filter((id) => id !== noteId);
  ids.push(noteId);

  return {
    ...metadata,
    [KEY]: ids.slice(-MAX_REMEMBERED_NOTE_IDS),
  };
}

export function isOutboundNoteId(
  rawMetadata: string | null,
  noteId: number,
): boolean {
  return readIds(parseMetadata(rawMetadata)).includes(noteId);
}
