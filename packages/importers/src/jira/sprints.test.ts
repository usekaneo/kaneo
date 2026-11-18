import { describe, expect, it } from "vite-plus/test";
import { SourceHttpError } from "../http.js";
import type { JiraSprint } from "./api-types.js";
import {
  mapSprintStatus,
  readBoardSprints,
  SPRINTS_UNAVAILABLE_WARNING,
  toImportedSprint,
} from "./sprints.js";

const client = (pages: {
  sprints?: unknown[];
  issues?: Record<string, unknown[][] | Error>;
  issuesKey?: "issues" | "values";
}) =>
  ({
    boardSprints: (_boardId: number, startAt: number) => {
      const values = pages.sprints?.[startAt];
      if (values === undefined) {
        return Promise.resolve({ values: [], isLast: true });
      }
      if (values instanceof Error) return Promise.reject(values);
      return Promise.resolve({ values, isLast: false });
    },
    sprintIssues: (sprintId: string, startAt: number) => {
      const page = pages.issues?.[sprintId]?.[startAt];
      if (page === undefined) {
        return Promise.resolve({ issues: [], isLast: true });
      }
      if (page instanceof Error) return Promise.reject(page);
      // Jira's agile issue search wraps its page in "issues", unlike the
      // sprint pages that use "values".
      return Promise.resolve({
        [pages.issuesKey ?? "issues"]: page,
        isLast: false,
      });
    },
  }) as never;

const sprint = (
  id: number,
  overrides: Partial<JiraSprint> = {},
): JiraSprint => ({
  id,
  name: `Sprint ${id}`,
  state: "closed",
  ...overrides,
});

describe("mapSprintStatus", () => {
  it("maps Jira states and treats anything else as future", () => {
    expect(mapSprintStatus("ACTIVE")).toBe("active");
    expect(mapSprintStatus(" closed ")).toBe("closed");
    expect(mapSprintStatus("future")).toBe("future");
    expect(mapSprintStatus(undefined)).toBe("future");
  });
});
describe("toImportedSprint", () => {
  it("keeps the sprint id as key and maps the fields", () => {
    expect(
      toImportedSprint({
        id: 9,
        name: " Q3 ",
        state: "active",
        goal: " Ship the Q3 release ",
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-14T00:00:00.000Z",
      }),
    ).toEqual({
      key: "9",
      name: "Q3",
      status: "active",
      goal: "Ship the Q3 release",
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-07-14T00:00:00.000Z",
    });
  });

  it("names unnamed sprints after their id", () => {
    expect(toImportedSprint({ id: 3, state: "future" }).name).toBe("Sprint 3");
  });

  it("drops an empty sprint goal", () => {
    expect(
      toImportedSprint({ id: 4, state: "future", goal: "  " }).goal,
    ).toBeUndefined();
  });
});
describe("readBoardSprints", () => {
  it("reads sprints and assigns issues to the later sprint", async () => {
    const read = await readBoardSprints(
      client({
        sprints: [
          [sprint(1), sprint(2, { state: "active", startDate: "2026-08-01" })],
        ],
        issues: {
          "1": [[{ id: "101" }, { id: "102" }]],
          "2": [[{ id: "101" }, { id: "103" }]],
        },
      }),
      7,
    );

    expect(read.sprints.map(({ key, status }) => ({ key, status }))).toEqual([
      { key: "1", status: "closed" },
      { key: "2", status: "active" },
    ]);
    expect(read.issueSprint).toEqual(
      new Map([
        ["101", "2"],
        ["102", "1"],
        ["103", "2"],
      ]),
    );
    expect(read.warning).toBeNull();
  });

  it("warns and continues without sprints when Jira denies access", async () => {
    const read = await readBoardSprints(
      client({ sprints: [new SourceHttpError("denied", 403, null)] }),
      7,
    );

    expect(read.sprints).toEqual([]);
    expect(read.issueSprint).toEqual(new Map());
    expect(read.warning).toBe(SPRINTS_UNAVAILABLE_WARNING);
  });

  it("drops only the assignments of a sprint it cannot read", async () => {
    const read = await readBoardSprints(
      client({
        sprints: [[sprint(1), sprint(2)]],
        issues: {
          "1": [new SourceHttpError("gone", 404, null)],
          "2": [[{ id: "101" }]],
        },
      }),
      7,
    );

    expect(read.issueSprint).toEqual(new Map([["101", "2"]]));
  });

  it("still reads pages a gateway normalizes to the values key", async () => {
    const read = await readBoardSprints(
      client({
        sprints: [[sprint(1)]],
        issues: { "1": [[{ id: "101" }]] },
        issuesKey: "values",
      }),
      7,
    );

    expect(read.issueSprint).toEqual(new Map([["101", "1"]]));
  });

  it("normalizes numeric Jira issue ids to strings", async () => {
    const read = await readBoardSprints(
      client({
        sprints: [[sprint(1)]],
        issues: { "1": [[{ id: 101 }]] },
      }),
      7,
    );

    expect(read.issueSprint).toEqual(new Map([["101", "1"]]));
  });
});
