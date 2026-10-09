import { describe, expect, it } from "vite-plus/test";
import type { TaskActivity } from "../api/activity.js";
import {
  activityActor,
  describeActivity,
  excerpt,
  toActivityEntry,
  toActivityJson,
} from "./describe-activity.js";

const lookups = {
  members: new Map([
    ["u1", "Ada Lovelace"],
    ["u2", "Grace Hopper"],
  ]),
  statuses: new Map([
    ["to-do", "To Do"],
    ["in-progress", "In Progress"],
  ]),
  now: new Date(2026, 9, 8, 15, 0),
};

const activity = (overrides: Partial<TaskActivity>): TaskActivity => ({
  id: "a1",
  type: "comment",
  createdAt: "2026-10-08T10:00:00.000Z",
  userId: "u1",
  content: null,
  eventData: null,
  externalUserName: null,
  ...overrides,
});

const summary = (overrides: Partial<TaskActivity>) =>
  describeActivity(activity(overrides), lookups).summary;

describe("describeActivity", () => {
  it("shows a comment with a plain excerpt", () => {
    expect(
      describeActivity(
        activity({ content: "**Ship** it\n\n- after review" }),
        lookups,
      ),
    ).toEqual({ summary: "commented", detail: "Ship it • after review" });
  });

  it("names the columns of a status change", () => {
    expect(
      summary({
        type: "status_changed",
        eventData: { oldStatus: "to-do", newStatus: "in-progress" },
      }),
    ).toBe("changed status from To Do to In Progress");
  });

  it("title-cases statuses the project no longer has", () => {
    expect(
      summary({
        type: "status_changed",
        eventData: { oldStatus: "in-review", newStatus: "done" },
      }),
    ).toBe("changed status from In Review to Done");
  });

  it("describes priority changes", () => {
    expect(
      summary({
        type: "priority_changed",
        eventData: { oldPriority: "no-priority", newPriority: "high" },
      }),
    ).toBe("changed priority from No priority to High");
  });

  it("describes assignments", () => {
    expect(
      summary({
        type: "assignee_changed",
        eventData: { newAssignee: "Grace Hopper", newAssigneeId: "u2" },
      }),
    ).toBe("assigned Grace Hopper");
    expect(
      summary({
        type: "assignee_changed",
        eventData: { isSelfAssigned: true },
      }),
    ).toBe("assigned themselves");
    expect(summary({ type: "unassigned" })).toBe("removed the assignee");
  });

  it("describes due date changes", () => {
    expect(
      summary({
        type: "due_date_changed",
        eventData: { oldDueDate: null, newDueDate: "2026-10-12T12:00:00.000Z" },
      }),
    ).toBe("set the due date to Oct 12");
    expect(
      summary({
        type: "due_date_changed",
        eventData: {
          oldDueDate: "2026-10-12T12:00:00.000Z",
          newDueDate: "2027-01-03T12:00:00.000Z",
        },
      }),
    ).toBe("changed the due date from Oct 12 to Jan 3, 2027");
    expect(
      summary({
        type: "due_date_changed",
        eventData: { oldDueDate: "2026-10-12T12:00:00.000Z", newDueDate: null },
      }),
    ).toBe("cleared the due date");
  });

  it("describes renames, moves and creation", () => {
    expect(
      summary({
        type: "title_changed",
        eventData: { oldTitle: "Fix login", newTitle: "Fix login redirect" },
      }),
    ).toBe('renamed the task from "Fix login" to "Fix login redirect"');
    expect(
      summary({
        type: "moved",
        eventData: { fromProjectName: "Kaneo Web", toProjectName: "Mobile" },
      }),
    ).toBe("moved the task from Kaneo Web to Mobile");
    expect(
      summary({
        type: "moved",
        eventData: { fromProjectName: null, toProjectName: "Mobile" },
      }),
    ).toBe("moved the task from another project to Mobile");
    expect(summary({ type: "created" })).toBe("created the task");
  });

  it("falls back to the stored text, then the type", () => {
    expect(summary({ type: "status_changed", content: "moved it" })).toBe(
      "moved it",
    );
    expect(summary({ type: "label_assigned" })).toBe("label assigned");
  });
});

describe("activityActor", () => {
  it("names workspace members", () => {
    expect(activityActor(activity({}), lookups.members)).toEqual({
      id: "u1",
      name: "Ada Lovelace",
    });
  });

  it("prefers the imported author", () => {
    expect(
      activityActor(
        activity({ externalUserName: "octocat", userId: null }),
        lookups.members,
      ),
    ).toEqual({ id: null, name: "octocat" });
  });

  it("is null without a user", () => {
    expect(
      activityActor(activity({ userId: null }), lookups.members),
    ).toBeNull();
  });
});

describe("toActivityJson", () => {
  it("joins the summary and detail into the message", () => {
    expect(
      toActivityJson(
        toActivityEntry(activity({ content: "Ship it" }), lookups),
      ),
    ).toEqual({
      id: "a1",
      type: "comment",
      actor: { id: "u1", name: "Ada Lovelace" },
      message: "commented: Ship it",
      createdAt: "2026-10-08T10:00:00.000Z",
    });
  });
});

describe("excerpt", () => {
  it("caps long text", () => {
    const text = excerpt("a".repeat(300)) ?? "";
    expect([...text]).toHaveLength(240);
    expect(text.endsWith("…")).toBe(true);
  });

  it("is null for blank content", () => {
    expect(excerpt("  \n ")).toBeNull();
  });
});
