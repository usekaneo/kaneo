import type { TimeEntry } from "../api/time-entries.js";
import { entrySeconds } from "./entry-seconds.js";

export type TimeEntryJson = {
  readonly id: string;
  readonly taskId: string;
  readonly ticketId: string | null;
  readonly user: { readonly id: string; readonly name: string | null } | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly durationSeconds: number;
  readonly note: string | null;
  readonly running: boolean;
};

export function toTimeEntryJson(
  entry: TimeEntry & { readonly userName?: string | null },
  ticketId: string | null,
  now: Date,
  userName: string | null = null,
): TimeEntryJson {
  const note = entry.description?.trim() ? entry.description : null;
  return {
    id: entry.id,
    taskId: entry.taskId,
    ticketId,
    user: entry.userId
      ? { id: entry.userId, name: entry.userName ?? userName }
      : null,
    startedAt: entry.startTime,
    endedAt: entry.endTime,
    durationSeconds: entrySeconds(entry, now),
    note,
    running: entry.endTime === null,
  };
}
