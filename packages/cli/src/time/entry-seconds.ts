export type TimedEntry = {
  readonly startTime: string;
  readonly endTime: string | null;
  readonly duration: number | null;
};

export function entrySeconds(entry: TimedEntry, now: Date): number {
  if (entry.duration !== null) return entry.duration;
  const start = Date.parse(entry.startTime);
  const end =
    entry.endTime === null ? now.getTime() : Date.parse(entry.endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}
