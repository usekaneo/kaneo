export type OwnedEntry = {
  readonly userId: string | null;
  readonly startTime: string;
  readonly endTime: string | null;
};

export function runningEntries<E extends OwnedEntry>(
  entries: ReadonlyArray<E>,
  userId: string,
): E[] {
  return entries
    .filter((entry) => entry.endTime === null && entry.userId === userId)
    .sort(
      (left, right) => Date.parse(right.startTime) - Date.parse(left.startTime),
    );
}
