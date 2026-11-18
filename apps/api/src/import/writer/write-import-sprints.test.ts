import { describe, expect, it } from "vite-plus/test";
import type { PlannedImportSprint } from "./plan-import-sprints";
import { writeImportSprints } from "./write-import-sprints";

type Transaction = Parameters<typeof writeImportSprints>[0];

type SprintRow = {
  id: string;
  projectId: string;
  name: string;
  status: "future" | "active" | "closed";
  position: number;
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
};

function planned(
  key: string,
  id: string,
  overrides: Partial<PlannedImportSprint> = {},
): PlannedImportSprint {
  return {
    key,
    id,
    name: `Sprint ${Number(key)}`,
    status: "future",
    goal: null,
    startDate: null,
    endDate: null,
    position: Number(key) - 1,
    ...overrides,
  };
}

async function writeSprints(sprints: PlannedImportSprint[]) {
  const rows: SprintRow[] = [];
  const tx = {
    insert: () => ({
      values: async (batch: SprintRow[]) => {
        rows.push(...batch);
      },
    }),
  } as unknown as Transaction;

  const sprintIds = await writeImportSprints(tx, "project-1", sprints);

  return { rows, sprintIds };
}

describe("writeImportSprints", () => {
  it("returns an empty map without inserting when there are no sprints", async () => {
    const { rows, sprintIds } = await writeSprints([]);

    expect(rows).toEqual([]);
    expect(sprintIds.size).toBe(0);
  });

  it("inserts the planned sprints and maps sprint keys to their ids", async () => {
    const { rows, sprintIds } = await writeSprints([
      planned("1", "sprint-1", { status: "closed", goal: "Ship it" }),
      planned("2", "sprint-2", {
        status: "active",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-01-14T00:00:00.000Z"),
      }),
      planned("3", "sprint-3", { name: "Sprint 3" }),
    ]);

    expect(rows).toEqual([
      {
        id: "sprint-1",
        projectId: "project-1",
        name: "Sprint 1",
        status: "closed",
        goal: "Ship it",
        startDate: null,
        endDate: null,
        position: 0,
      },
      {
        id: "sprint-2",
        projectId: "project-1",
        name: "Sprint 2",
        status: "active",
        goal: null,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-01-14T00:00:00.000Z"),
        position: 1,
      },
      {
        id: "sprint-3",
        projectId: "project-1",
        name: "Sprint 3",
        status: "future",
        goal: null,
        startDate: null,
        endDate: null,
        position: 2,
      },
    ]);

    expect(sprintIds).toEqual(
      new Map([
        ["1", "sprint-1"],
        ["2", "sprint-2"],
        ["3", "sprint-3"],
      ]),
    );
  });

  it("keeps the source key of each sprint attached to its created id", async () => {
    const { sprintIds } = await writeSprints([
      planned("original-key", "sprint-1"),
    ]);

    expect(sprintIds.get("original-key")).toBe("sprint-1");
  });
});
