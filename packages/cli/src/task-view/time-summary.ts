import type { TimeEntryWithUser } from "../api/time-entries.js";
import { entrySeconds } from "../time/entry-seconds.js";

export type RunningTimerJson = {
  readonly user: { readonly id: string; readonly name: string | null } | null;
  readonly startedAt: string;
};

export type TimeSummaryJson = {
  readonly totalSeconds: number;
  readonly running: ReadonlyArray<RunningTimerJson>;
};

export function summarizeTime(
  entries: ReadonlyArray<TimeEntryWithUser>,
  now: Date,
): TimeSummaryJson {
  return {
    totalSeconds: entries.reduce(
      (sum, entry) => sum + entrySeconds(entry, now),
      0,
    ),
    running: entries
      .filter((entry) => entry.endTime === null)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
      .map((entry) => ({
        user: entry.userId ? { id: entry.userId, name: entry.userName } : null,
        startedAt: entry.startTime,
      })),
  };
}
