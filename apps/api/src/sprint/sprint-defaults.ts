// Pure sprint helpers shared by the API controllers and unit tests. They must
// stay free of database and Hono imports.

export const DEFAULT_SPRINT_LENGTH_DAYS = 14;

/** Returns the default sprint end date: start date plus the project's default length. */
export function deriveSprintEndDate(
  startDate: Date,
  defaultLengthDays: number,
): Date {
  const endDate = new Date(startDate.getTime());
  endDate.setDate(
    endDate.getDate() + Math.max(1, Math.trunc(defaultLengthDays)),
  );
  return endDate;
}

/** Generates the next free "Sprint N" name for a project. */
export function nextSprintName(existingNames: string[]): string {
  const taken = new Set(existingNames);
  let candidate = 1;
  while (taken.has(`Sprint ${candidate}`)) {
    candidate += 1;
  }
  return `Sprint ${candidate}`;
}
