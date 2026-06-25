import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: labels", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated label creation", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/label", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Bug",
        color: "#ff0000",
        workspaceId: "workspace-missing",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("creates a label in a workspace for a member", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/label", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
      }),
    });

    expect(response.status).toBe(200);
    const payload =
      (await response.json()) as typeof schema.labelTable.$inferSelect;

    expect(payload).toMatchObject({
      workspaceId: member.workspace.id,
      name: "Bug",
      color: "#ef4444",
    });

    const persisted = await db.query.labelTable.findFirst({
      where: eq(schema.labelTable.id, payload.id),
    });

    expect(persisted).toMatchObject({
      id: payload.id,
      workspaceId: member.workspace.id,
      name: "Bug",
      color: "#ef4444",
    });
  });

  it("rejects label creation for users outside the workspace", async () => {
    const member = await createWorkspaceMember();
    const outsiderId = "user-label-outsider";

    const [outsider] = await db
      .insert(schema.userTable)
      .values({
        id: outsiderId,
        email: `${outsiderId}@example.com`,
        emailVerified: true,
        name: "Label Outsider",
      })
      .returning();

    mockAuthenticatedSession(outsider);
    const { app } = createApp();

    const response = await app.request("/api/label", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Blocked",
        color: "#6b7280",
        workspaceId: member.workspace.id,
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe(
      "You don't have access to this workspace",
    );

    const persisted = await db.query.labelTable.findFirst({
      where: eq(schema.labelTable.name, "Blocked"),
    });

    expect(persisted).toBeUndefined();
  });

  describe("deletion cascade", () => {
    it("deletes task-level copies when a workspace label is deleted", async () => {
      const member = await createWorkspaceMember();
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      // Create two tasks to assign labels to
      const [taskA] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          userId: member.user.id,
          title: "Task A",
          status: "to-do",
          columnId: columns.todo.id,
          priority: "medium",
          number: 1,
          position: 1,
        })
        .returning();

      const [taskB] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          userId: member.user.id,
          title: "Task B",
          status: "to-do",
          columnId: columns.todo.id,
          priority: "medium",
          number: 2,
          position: 2,
        })
        .returning();

      // Create a workspace-level label
      const [workspaceLabel] = await db
        .insert(schema.labelTable)
        .values({
          name: "Bug",
          color: "#ef4444",
          workspaceId: member.workspace.id,
          taskId: null,
        })
        .returning();

      // Create task-level copies (simulating assigning the label to tasks)
      const [taskLabelA] = await db
        .insert(schema.labelTable)
        .values({
          name: "Bug",
          color: "#ef4444",
          workspaceId: member.workspace.id,
          taskId: taskA.id,
        })
        .returning();

      const [_taskLabelB] = await db
        .insert(schema.labelTable)
        .values({
          name: "Bug",
          color: "#ef4444",
          workspaceId: member.workspace.id,
          taskId: taskB.id,
        })
        .returning();

      // Verify all three labels exist
      const before = await db.query.labelTable.findMany({
        where: eq(schema.labelTable.workspaceId, member.workspace.id),
      });
      expect(before).toHaveLength(3);

      // Delete the workspace-level label via the API
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/label/${workspaceLabel.id}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(200);

      // Verify the workspace label and task-level copies are all gone
      const remaining = await db.query.labelTable.findMany({
        where: eq(schema.labelTable.workspaceId, member.workspace.id),
      });
      expect(remaining).toHaveLength(0);
    });

    it("does not affect unrelated labels when deleting a workspace label", async () => {
      const member = await createWorkspaceMember();
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          userId: member.user.id,
          title: "Task",
          status: "to-do",
          columnId: columns.todo.id,
          priority: "medium",
          number: 1,
          position: 1,
        })
        .returning();

      // Create two different workspace labels
      const [labelBug] = await db
        .insert(schema.labelTable)
        .values({
          name: "Bug",
          color: "#ef4444",
          workspaceId: member.workspace.id,
          taskId: null,
        })
        .returning();

      const [labelFeature] = await db
        .insert(schema.labelTable)
        .values({
          name: "Feature",
          color: "#3b82f6",
          workspaceId: member.workspace.id,
          taskId: null,
        })
        .returning();

      // Create task-level copies for both
      await db.insert(schema.labelTable).values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: task.id,
      });

      const [featureCopy] = await db
        .insert(schema.labelTable)
        .values({
          name: "Feature",
          color: "#3b82f6",
          workspaceId: member.workspace.id,
          taskId: task.id,
        })
        .returning();

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      // Delete only the "Bug" workspace label
      const response = await app.request(`/api/label/${labelBug.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);

      // "Feature" workspace label and its task-level copy should still exist
      const featureWorkspace = await db.query.labelTable.findFirst({
        where: eq(schema.labelTable.id, labelFeature.id),
      });
      expect(featureWorkspace).toBeDefined();

      const featureTaskCopy = await db.query.labelTable.findFirst({
        where: eq(schema.labelTable.id, featureCopy.id),
      });
      expect(featureTaskCopy).toBeDefined();
    });
  });
});
