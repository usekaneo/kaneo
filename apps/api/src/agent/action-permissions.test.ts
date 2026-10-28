import { describe, expect, it } from "vite-plus/test";
import { actionPermissions } from "./action-permissions";

describe("actionPermissions", () => {
  it("requires task update to post a comment, like the comment API", () => {
    expect(
      actionPermissions({ type: "comment.create", taskId: "t", body: "Hi" }),
    ).toEqual({ task: ["update"] });
  });

  it("requires assign only for assignee changes", () => {
    expect(
      actionPermissions({
        type: "task.update",
        taskId: "t",
        patch: { userId: "u" },
      }),
    ).toEqual({ task: ["assign"] });
    expect(
      actionPermissions({
        type: "task.update",
        taskId: "t",
        patch: { userId: null, priority: "high" },
      }),
    ).toEqual({ task: ["update", "assign"] });
  });
});
