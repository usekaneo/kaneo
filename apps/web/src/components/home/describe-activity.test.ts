import { describe, expect, it } from "vite-plus/test";
import type { WorkspaceActivity } from "@/fetchers/activity/get-workspace-activities";
import { describeActivity } from "./describe-activity";

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

function activity(overrides: Partial<WorkspaceActivity>): WorkspaceActivity {
  return {
    id: "activity-1",
    type: "comment",
    createdAt: "2026-10-02T10:00:00.000Z",
    eventData: null,
    excerpt: null,
    userId: "user-1",
    userName: "Mira",
    userImage: null,
    externalUserName: null,
    externalUserAvatar: null,
    taskId: "task-1",
    taskTitle: "Fix reconnect loop",
    taskNumber: 135,
    projectId: "project-1",
    projectSlug: "WEB",
    ...overrides,
  };
}

describe("describeActivity", () => {
  it("names comments without repeating their body", () => {
    expect(describeActivity(activity({ excerpt: "Looks good" }), t)).toBe(
      "workspace:home.activity.commented",
    );
  });

  it("describes structured events from their event data", () => {
    expect(
      describeActivity(
        activity({
          type: "assignee_changed",
          eventData: { newAssignee: "Alex", isSelfAssigned: false },
        }),
        t,
      ),
    ).toBe('activity:assignedTo {"name":"Alex"}');
    expect(
      describeActivity(
        activity({ type: "due_date_changed", eventData: { newDueDate: null } }),
        t,
      ),
    ).toBe("activity:clearedDueDate");
  });

  it("uses configured status names and falls back for deleted columns", () => {
    expect(
      describeActivity(
        activity({
          type: "status_changed",
          eventData: {
            oldStatus: "review",
            newStatus: "approved",
            oldStatusName: "Awaiting approval",
            newStatusName: "Ready to ship",
          },
        }),
        t,
      ),
    ).toBe(
      'activity:changedStatus {"from":"Awaiting approval","to":"Ready to ship"}',
    );
    expect(
      describeActivity(
        activity({
          type: "status_changed",
          eventData: {
            oldStatus: "removed-lane",
            newStatus: "review",
            newStatusName: "Awaiting approval",
          },
        }),
        t,
      ),
    ).toBe(
      'activity:changedStatus {"from":"Removed Lane","to":"Awaiting approval"}',
    );
  });

  it("falls back to the stored text for events without event data", () => {
    expect(
      describeActivity(
        activity({
          type: "status_changed",
          excerpt: "changed status from to-do to done",
        }),
        t,
      ),
    ).toBe("changed status from to-do to done");
    expect(describeActivity(activity({ type: "label_added" }), t)).toBe(
      "workspace:home.activity.updated",
    );
  });
});
