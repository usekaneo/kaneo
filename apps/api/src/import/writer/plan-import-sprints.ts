import type { ImportedSprint } from "@kaneo/importers";
import { parseImportDate } from "./plan-import-tasks";

export type PlannedImportSprint = {
  key: string;
  id: string;
  name: string;
  status: "future" | "active" | "closed";
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
  position: number;
};

const SPRINT_STATUSES = ["future", "active", "closed"] as const;

function sprintStatus(status: string): PlannedImportSprint["status"] {
  return (SPRINT_STATUSES as readonly string[]).includes(status)
    ? (status as PlannedImportSprint["status"])
    : "future";
}

// A closed sprint keeps completed tasks as its history, so the import places
// every task of these source keys in the final column.
export function closedSprintKeys(
  sprints: readonly ImportedSprint[],
): Set<string> {
  return new Set(
    sprints
      .filter((sprint) => sprint.status === "closed")
      .map((sprint) => sprint.key),
  );
}

// Sprint names are unique per project; a duplicate from the source would abort
// the whole import on the unique constraint, so conflicting names get a suffix.
export function planImportSprints(
  sprints: readonly ImportedSprint[],
  newId: () => string,
): PlannedImportSprint[] {
  const usedNames = new Set<string>();

  return sprints.map((sprint, index) => {
    const base = sprint.name.trim() || `Sprint ${index + 1}`;
    let name = base;
    for (let suffix = 2; usedNames.has(name.toLowerCase()); suffix++) {
      name = `${base} ${suffix}`;
    }
    usedNames.add(name.toLowerCase());

    return {
      key: sprint.key,
      id: newId(),
      name,
      status: sprintStatus(sprint.status),
      goal: sprint.goal?.trim() || null,
      startDate: parseImportDate(sprint.startDate),
      endDate: parseImportDate(sprint.endDate),
      position: index,
    };
  });
}
