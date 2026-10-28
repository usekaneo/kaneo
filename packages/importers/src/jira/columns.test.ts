import { describe, expect, it } from "vite-plus/test";
import type { JiraStatus } from "./api-types.js";
import {
  collectStatuses,
  planBoardColumns,
  planStatusColumns,
  resolveColumnKey,
  statusCategories,
} from "./columns.js";

function status(id: string, name: string, category?: string): JiraStatus {
  return {
    id,
    name,
    ...(category ? { statusCategory: { key: category } } : {}),
  };
}

const BACKLOG = status("1", "Backlog", "new");
const TODO = status("2", "Selected for Development", "new");
const DOING = status("3", "In Progress", "indeterminate");
const REVIEW = status("4", "In Review", "indeterminate");
const DONE = status("5", "Done", "done");
const WONT = status("6", "Won't Do", "done");
const ARCHIVED = status("7", "Archived", "done");

const CATEGORIES = statusCategories([
  BACKLOG,
  TODO,
  DOING,
  REVIEW,
  DONE,
  WONT,
  ARCHIVED,
]);

function ids(...statuses: JiraStatus[]) {
  return statuses.map((item) => ({ id: item.id }));
}

describe("planBoardColumns", () => {
  it("keeps board columns in order, sends Backlog to the Kaneo backlog and marks final columns", () => {
    const plan = planBoardColumns(
      [
        { name: "Backlog", statuses: ids(BACKLOG) },
        { name: "To Do", statuses: ids(TODO) },
        { name: "Doing", statuses: ids(DOING, REVIEW) },
        { name: "Rejected", statuses: ids(WONT) },
        { name: "Empty", statuses: [] },
        { name: "Shipped", statuses: ids(DONE) },
      ],
      CATEGORIES,
    );

    expect(plan.columns).toEqual([
      { key: "column-2", name: "To Do", isFinal: false },
      { key: "column-3", name: "Doing", isFinal: false },
      { key: "column-4", name: "Rejected", isFinal: true },
      { key: "column-6", name: "Shipped", isFinal: true },
    ]);
    expect(Object.fromEntries(plan.columnKeyByStatus)).toEqual({
      "1": null,
      "2": "column-2",
      "3": "column-3",
      "4": "column-3",
      "5": "column-6",
      "6": "column-4",
    });
  });

  it("treats the last column as final even when its statuses are not done", () => {
    const plan = planBoardColumns(
      [
        { name: "Open", statuses: ids(TODO) },
        { name: "  ", statuses: ids(REVIEW) },
      ],
      new Map(),
    );
    expect(plan.columns).toEqual([
      { key: "column-1", name: "Open", isFinal: false },
      { key: "column-2", name: "Untitled", isFinal: true },
    ]);
  });

  it("keeps the first column a status was placed in", () => {
    const plan = planBoardColumns(
      [
        { name: "A", statuses: ids(TODO) },
        { name: "B", statuses: ids(TODO, DONE) },
      ],
      CATEGORIES,
    );
    expect(plan.columnKeyByStatus.get("2")).toBe("column-1");
  });
});

describe("planStatusColumns", () => {
  it("orders statuses by category, keeps first seen order and marks done statuses final", () => {
    const plan = planStatusColumns([
      DONE,
      DOING,
      status("8", "Mystery"),
      TODO,
      BACKLOG,
      WONT,
    ]);

    expect(plan.columns).toEqual([
      { key: "2", name: "Selected for Development", isFinal: false },
      { key: "3", name: "In Progress", isFinal: false },
      { key: "8", name: "Mystery", isFinal: false },
      { key: "5", name: "Done", isFinal: true },
      { key: "6", name: "Won't Do", isFinal: true },
    ]);
    expect(plan.columnKeyByStatus.get("1")).toBeNull();
  });
});

describe("resolveColumnKey", () => {
  const plan = planBoardColumns(
    [
      { name: "Backlog", statuses: ids(BACKLOG) },
      { name: "To Do", statuses: ids(TODO) },
      { name: "Done", statuses: ids(DONE) },
    ],
    CATEGORIES,
  );

  it("uses the mapped column or the backlog", () => {
    expect(resolveColumnKey(plan, "2", CATEGORIES)).toBe("column-2");
    expect(resolveColumnKey(plan, "1", CATEGORIES)).toBeNull();
    expect(resolveColumnKey(plan, undefined, CATEGORIES)).toBeNull();
  });

  it("places statuses missing from the board by category", () => {
    expect(resolveColumnKey(plan, "7", CATEGORIES)).toBe("column-3");
    expect(resolveColumnKey(plan, "4", CATEGORIES)).toBeNull();
    expect(resolveColumnKey(plan, "unknown", CATEGORIES)).toBeNull();
  });
});

describe("collectStatuses", () => {
  it("dedupes statuses across issue types and adds statuses only seen on issues", () => {
    const statuses = collectStatuses(
      [
        { name: "Task", statuses: [TODO, DOING, DONE] },
        { name: "Sub-task", statuses: [TODO, DONE] },
      ],
      [
        { id: "i1", key: "ABC-1", fields: { status: DOING } },
        { id: "i2", key: "ABC-2", fields: { status: ARCHIVED } },
        { id: "i3", key: "ABC-3", fields: null },
      ],
    );
    expect(statuses.map((item) => item.id)).toEqual(["2", "3", "5", "7"]);
  });
});
