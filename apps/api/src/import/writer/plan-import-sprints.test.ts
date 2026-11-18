import type { ImportedSprint } from "@kaneo/importers";
import { describe, expect, it } from "vite-plus/test";
import { closedSprintKeys, planImportSprints } from "./plan-import-sprints";

const sprint = (
  key: string,
  overrides: Partial<ImportedSprint> = {},
): ImportedSprint => ({
  key,
  name: `Sprint ${key}`,
  status: "future",
  ...overrides,
});

describe("planImportSprints", () => {
  it("keeps sprint order, status and dates", () => {
    const planned = planImportSprints(
      [
        sprint("1", {
          status: "closed",
          goal: "Ship it",
          startDate: "2026-01-01",
          endDate: "2026-01-14",
        }),
        sprint("2", { status: "active" }),
      ],
      () => "new-id",
    );

    expect(planned).toEqual([
      {
        key: "1",
        id: "new-id",
        name: "Sprint 1",
        status: "closed",
        goal: "Ship it",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-01-14T00:00:00.000Z"),
        position: 0,
      },
      {
        key: "2",
        id: "new-id",
        name: "Sprint 2",
        status: "active",
        goal: null,
        startDate: null,
        endDate: null,
        position: 1,
      },
    ]);
  });

  it("renames duplicate sprint names so the import cannot fail on the unique constraint", () => {
    const planned = planImportSprints(
      [
        sprint("1", { name: "Rel" }),
        sprint("2", { name: "rel" }),
        sprint("3", { name: "" }),
      ],
      () => "id",
    );

    expect(planned.map(({ key, name }) => ({ key, name }))).toEqual([
      { key: "1", name: "Rel" },
      { key: "2", name: "rel 2" },
      { key: "3", name: "Sprint 3" },
    ]);
  });

  it("treats an unknown status as future", () => {
    const planned = planImportSprints(
      [
        sprint("1", {
          status: "started" as unknown as ImportedSprint["status"],
        }),
      ],
      () => "id",
    );
    expect(planned[0]?.status).toBe("future");
  });

  it("plans no sprints for an empty list", () => {
    expect(planImportSprints([], () => "id")).toEqual([]);
  });
});
describe("closedSprintKeys", () => {
  it("collects the keys of the sprints imported as closed", () => {
    expect(
      closedSprintKeys([
        sprint("1", { status: "closed" }),
        sprint("2", { status: "active" }),
        sprint("3", { status: "closed" }),
      ]),
    ).toEqual(new Set(["1", "3"]));
  });
});
