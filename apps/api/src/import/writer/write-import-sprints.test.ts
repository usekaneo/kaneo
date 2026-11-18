import type { ImportedSprint } from "@kaneo/importers";
import { describe, expect, it } from "vite-plus/test";
import { writeImportSprints } from "./write-import-sprints";

type Transaction = Parameters<typeof writeImportSprints>[0];

const now = new Date("2026-10-11T12:00:00.000Z");

type SprintRow = {
  id: string;
  name: string;
  status: "future" | "active" | "closed";
  position: number;
  goal: string | null;
};

function sprint(
  key: string,
  overrides: Partial<ImportedSprint> = {},
): ImportedSprint {
  return {
    key,
    name: `Sprint ${key}`,
    state: "future",
    taskKeys: [],
    ...overrides,
  };
}

async function writeSprints(sprints: ImportedSprint[]) {
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

  it("inserts sprints and maps sprint keys to their ids", async () => {
    const { rows, sprintIds } = await writeSprints([
      sprint("1", { state: "closed", name: "Sprint 1", goal: "Ship it" }),
      sprint("2", { state: "active", name: "Sprint 2" }),
      sprint("3", { state: "future", name: "Sprint 3" }),
    ]);

    expect(
      rows.map(({ name, status, goal, position }) => ({
        name,
        status,
        goal,
        position,
      })),
    ).toEqual([
      { name: "Sprint 1", status: "closed", goal: "Ship it", position: 0 },
      { name: "Sprint 2", status: "active", goal: null, position: 1 },
      { name: "Sprint 3", status: "future", goal: null, position: 2 },
    ]);

    expect(sprintIds.size).toBe(3);
    expect(sprintIds.get("1")).toBe(rows[0]?.id);
    expect(sprintIds.get("2")).toBe(rows[1]?.id);
    expect(sprintIds.get("3")).toBe(rows[2]?.id);
  });

  it("keeps only the first active sprint active", async () => {
    const { rows } = await writeSprints([
      sprint("1", { state: "active" }),
      sprint("2", { state: "active" }),
      sprint("3", { state: "active" }),
    ]);

    expect(rows.map(({ status }) => status)).toEqual([
      "active",
      "future",
      "future",
    ]);
  });

  it("uniquifies duplicate sprint names and fallback names", async () => {
    const { rows } = await writeSprints([
      sprint("1", { name: "Sprint 1" }),
      sprint("2", { name: "Sprint 1" }),
      sprint("3", { name: "  " }),
      sprint("4", { name: "" }),
    ]);

    expect(rows.map(({ name }) => name)).toEqual([
      "Sprint 1",
      "Sprint 1 (2)",
      "Sprint 3",
      "Sprint 4",
    ]);
  });
});
