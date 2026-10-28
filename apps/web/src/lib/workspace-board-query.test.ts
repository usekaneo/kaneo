import { describe, expect, it } from "vite-plus/test";
import type { BoardFilters } from "@/hooks/use-task-filters";
import { toWorkspaceBoardQuery } from "./workspace-board-query";

const empty: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
  customFields: null,
  project: null,
};

describe("toWorkspaceBoardQuery", () => {
  it("sends nothing but the completion flag when no filter is set", () => {
    expect(toWorkspaceBoardQuery(empty, false)).toEqual({
      includeCompleted: "false",
    });
  });

  it("joins multi-value filters with commas", () => {
    expect(
      toWorkspaceBoardQuery(
        {
          ...empty,
          project: ["p1", "p2"],
          assignee: ["unassigned", "u1"],
          status: ["to-do"],
          priority: ["high", "urgent"],
          labels: ["l1"],
        },
        true,
      ),
    ).toEqual({
      projectIds: "p1,p2",
      assigneeIds: "unassigned,u1",
      status: "to-do",
      priority: "high,urgent",
      labelIds: "l1",
      includeCompleted: "true",
    });
  });

  it("turns this and next week into one date range", () => {
    // Wednesday 2026-10-07; weeks start on Monday.
    const now = new Date("2026-10-07T12:00:00.000Z");
    const query = toWorkspaceBoardQuery(
      { ...empty, dueDate: ["dueThisWeek", "dueNextWeek"] },
      false,
      { now, weekStartsOn: 1 },
    );
    expect(new Date(query.dueAfter ?? "").getDay()).toBe(1);
    expect(new Date(query.dueAfter ?? "") <= now).toBe(true);
    const twoWeeksLater = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000);
    expect(new Date(query.dueBefore ?? "") >= twoWeeksLater).toBe(true);
  });

  it("leaves negated subjects to the client", () => {
    expect(
      toWorkspaceBoardQuery(
        {
          ...empty,
          assignee: ["u1"],
          project: ["p1"],
          labels: ["l1"],
          dueDate: ["dueThisWeek"],
          negated: ["assignee", "labels", "dueDate"],
        },
        false,
      ),
    ).toEqual({ projectIds: "p1", includeCompleted: "false" });
  });

  it("sends one label id per selected label group", () => {
    const labels = [
      { id: "w1", name: "Bug", color: "red" },
      { id: "t1", name: "Bug", color: "red" },
      { id: "t2", name: "Bug", color: "red" },
      { id: "w2", name: "Docs", color: "blue" },
    ];
    expect(
      toWorkspaceBoardQuery({ ...empty, labels: ["w1", "t1", "t2"] }, false, {
        labels,
      }).labelIds,
    ).toBe("w1");
  });

  it("keeps undated tasks a client-side filter", () => {
    const query = toWorkspaceBoardQuery(
      { ...empty, dueDate: ["noDueDate", "dueThisWeek"] },
      false,
    );
    expect(query.dueAfter).toBeUndefined();
    expect(query.dueBefore).toBeUndefined();
  });
});
