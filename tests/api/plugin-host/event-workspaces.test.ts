import { describe, expect, it } from "vite-plus/test";
import { eventWorkspaces } from "../../../apps/api/src/plugin-host/events/event-workspaces";

describe("eventWorkspaces", () => {
  it("delivers project.moved to plugins on in either workspace", () => {
    expect(
      eventWorkspaces({
        type: "project.moved",
        projectId: "project-1",
        actorId: "user-1",
        fromWorkspaceId: "workspace-1",
        toWorkspaceId: "workspace-2",
      }),
    ).toEqual({
      workspaceId: "workspace-2",
      enabledIn: ["workspace-1", "workspace-2"],
    });
  });

  it("drops task events without a recorded workspace", () => {
    expect(
      eventWorkspaces({
        type: "task.deleted",
        projectId: "project-1",
        taskId: "task-1",
        actorId: null,
        title: "Gone",
      }),
    ).toBeNull();
  });
});
