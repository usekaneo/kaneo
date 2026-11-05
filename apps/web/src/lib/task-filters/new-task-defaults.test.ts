import { afterEach, describe, expect, it } from "vite-plus/test";
import type { BoardFilters } from "@/hooks/use-task-filters";
import {
  getNewTaskDefaults,
  readStoredNewTaskDefaults,
  resolveDefaultLabels,
} from "./new-task-defaults";

const filters = (overrides: Partial<BoardFilters>): BoardFilters => ({
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
  customFields: null,
  negated: null,
  ...overrides,
});

describe("getNewTaskDefaults", () => {
  it("uses nothing when no filter is active", () => {
    expect(getNewTaskDefaults(filters({}))).toEqual({
      priority: null,
      assigneeId: null,
      labelIds: [],
      customFields: {},
    });
  });

  it("uses a single priority and a single assignee", () => {
    expect(
      getNewTaskDefaults(filters({ priority: ["high"], assignee: ["u1"] })),
    ).toMatchObject({ priority: "high", assigneeId: "u1" });
  });

  it("skips priority and assignee when several values are selected", () => {
    expect(
      getNewTaskDefaults(
        filters({ priority: ["high", "low"], assignee: ["u1", "u2"] }),
      ),
    ).toMatchObject({ priority: null, assigneeId: null });
  });

  it("ignores an unknown priority and an empty assignee value", () => {
    expect(
      getNewTaskDefaults(filters({ priority: ["bogus"], assignee: [""] })),
    ).toMatchObject({ priority: null, assigneeId: null });
  });

  it("uses every selected label", () => {
    expect(
      getNewTaskDefaults(filters({ labels: ["l1", "l2"] })).labelIds,
    ).toEqual(["l1", "l2"]);
  });

  it("never uses a negated filter", () => {
    expect(
      getNewTaskDefaults(
        filters({
          priority: ["high"],
          assignee: ["u1"],
          labels: ["l1"],
          customFields: { f1: ["a"] },
          negated: ["priority", "assignee", "labels", "customField:f1"],
        }),
      ),
    ).toEqual({
      priority: null,
      assigneeId: null,
      labelIds: [],
      customFields: {},
    });
  });

  it("uses a custom field only when it allows exactly one value", () => {
    expect(
      getNewTaskDefaults(
        filters({ customFields: { one: ["a"], many: ["a", "b"] } }),
      ).customFields,
    ).toEqual({ one: "a" });
  });

  it("never uses status or due-date filters", () => {
    expect(
      getNewTaskDefaults(
        filters({ status: ["done"], dueDate: ["due-this-week"] }),
      ),
    ).toEqual({
      priority: null,
      assigneeId: null,
      labelIds: [],
      customFields: {},
    });
  });
});

describe("readStoredNewTaskDefaults", () => {
  afterEach(() => window.localStorage.clear());

  it("reads the filters the board stored for the project", () => {
    window.localStorage.setItem(
      "kaneo:board-filters:p1",
      JSON.stringify(filters({ priority: ["urgent"] })),
    );
    expect(readStoredNewTaskDefaults("p1").priority).toBe("urgent");
    expect(readStoredNewTaskDefaults("p2").priority).toBeNull();
    expect(readStoredNewTaskDefaults(undefined).priority).toBeNull();
  });

  it("falls back to nothing on corrupt storage", () => {
    window.localStorage.setItem("kaneo:board-filters:p1", "{not json");
    expect(readStoredNewTaskDefaults("p1").labelIds).toEqual([]);
  });
});

describe("resolveDefaultLabels", () => {
  const catalog = {
    id: "c1",
    name: "Client A",
    color: "#FF0000",
    taskId: null,
  };
  const copy = { id: "t1", name: "Client A", color: "#ff0000", taskId: "task" };
  const other = { id: "c2", name: "Other", color: "blue", taskId: null };

  it("resolves a per-task copy id to the catalog label of its group", () => {
    expect(resolveDefaultLabels([copy, catalog, other], ["t1"])).toEqual([
      catalog,
    ]);
  });

  it("returns one label per group and drops unknown ids", () => {
    expect(
      resolveDefaultLabels([catalog, copy, other], ["c1", "t1", "c2", "gone"]),
    ).toEqual([catalog, other]);
  });
});
