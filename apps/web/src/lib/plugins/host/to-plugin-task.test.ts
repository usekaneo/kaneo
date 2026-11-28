import { describe, expect, it } from "vite-plus/test";
import { flattenBoardTasks, toIsoDate, toPluginTask } from "./to-plugin-task";

const task = {
  id: "t1",
  projectId: "p1",
  number: 7,
  title: "Ship plugins",
  description: null,
  status: "in-progress",
  priority: "high",
  assigneeId: "u1",
  assigneeName: "Ada Lovelace",
  startDate: null,
  dueDate: "2026-10-07T12:00:00.000Z",
  position: 3,
  labels: [],
};

describe("toIsoDate", () => {
  it("normalises strings and dates and rejects invalid values", () => {
    expect(toIsoDate("2026-10-07")).toBe("2026-10-07T00:00:00.000Z");
    expect(toIsoDate(new Date("2026-10-07T12:00:00Z"))).toBe(
      "2026-10-07T12:00:00.000Z",
    );
    expect(toIsoDate("not a date")).toBeNull();
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });
});

describe("toPluginTask", () => {
  it("keeps only the stable plugin fields", () => {
    expect(toPluginTask(task)).toEqual({
      id: "t1",
      projectId: "p1",
      number: 7,
      title: "Ship plugins",
      description: null,
      status: "in-progress",
      priority: "high",
      assigneeId: "u1",
      assigneeName: "Ada Lovelace",
      startDate: null,
      dueDate: "2026-10-07T12:00:00.000Z",
    });
  });

  it("defaults a missing assignee name to null", () => {
    expect(
      toPluginTask({ ...task, assigneeId: null, assigneeName: null }),
    ).toMatchObject({ assigneeId: null, assigneeName: null });
  });
});

describe("flattenBoardTasks", () => {
  it("flattens columns then planned tasks without duplicates", () => {
    const board = {
      columns: [
        { tasks: [task, { ...task, id: "t2" }] },
        { tasks: [{ ...task, id: "t3" }] },
      ],
      plannedTasks: [{ ...task, id: "t4" }, task],
    };

    expect(flattenBoardTasks(board).map((item) => item.id)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
    ]);
  });
});
