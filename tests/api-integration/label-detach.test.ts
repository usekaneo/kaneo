import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type RecordedEvent = {
  type: string;
  data: unknown;
};

const recordedEvents: RecordedEvent[] = [];
let subscribersInitialized = false;

function initEventSubscribers() {
  if (subscribersInitialized) return;
  subscribersInitialized = true;
  subscribeToEvent("task.label_assigned", async (data) => {
    recordedEvents.push({ type: "task.label_assigned", data });
  });
  subscribeToEvent("task.label_unassigned", async (data) => {
    recordedEvents.push({ type: "task.label_unassigned", data });
  });
}

async function seedTask(userId: string, projectId: string) {
  return db
    .insert(schema.taskTable)
    .values({
      projectId,
      userId,
      title: "Seed",
      status: "to-do",
      priority: "medium",
      number: 1,
      position: 1,
    })
    .returning();
}

describe("API integration: label detach/attach", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    recordedEvents.length = 0;
    initEventSubscribers();
  });

  it("allows a workspace definition and a task assignment with the same name to coexist", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTask(member.user.id, project.id);

    const [workspaceLabel] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: null,
      })
      .returning();

    const [taskCopy] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: task.id,
      })
      .returning();

    const allLabels = await db.query.labelTable.findMany({
      where: eq(schema.labelTable.workspaceId, member.workspace.id),
    });
    expect(allLabels).toHaveLength(2);
    expect(workspaceLabel.taskId).toBeNull();
    expect(taskCopy.taskId).toBe(task.id);
  });

  it("attaches a label to a task without mutating the workspace definition", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTask(member.user.id, project.id);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const createResponse = await app.request("/api/label", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Feature",
        color: "#3b82f6",
        workspaceId: member.workspace.id,
      }),
    });
    expect(createResponse.status).toBe(200);
    const label = (await createResponse.json()) as {
      id: string;
      name: string;
      color: string;
    };

    const attachResponse = await app.request(`/api/label/${label.id}/task`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    expect(attachResponse.status).toBe(200);

    const allLabels = await db.query.labelTable.findMany({
      where: and(
        eq(schema.labelTable.workspaceId, member.workspace.id),
        eq(schema.labelTable.name, "Feature"),
      ),
    });

    const workspaceLabel = allLabels.find((l) => l.taskId === null);
    const taskCopy = allLabels.find((l) => l.taskId === task.id);

    expect(workspaceLabel).toBeDefined();
    expect(taskCopy).toBeDefined();
    expect(workspaceLabel?.id).toBe(label.id);
    expect(workspaceLabel?.taskId).toBeNull();
    expect(taskCopy?.taskId).toBe(task.id);
  });

  it("makes repeated attachment idempotent without creating duplicates", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTask(member.user.id, project.id);

    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: null,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const first = await app.request(`/api/label/${label.id}/task`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    expect(first.status).toBe(200);

    const second = await app.request(`/api/label/${label.id}/task`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    expect(second.status).toBe(200);

    const allLabels = await db.query.labelTable.findMany({
      where: and(
        eq(schema.labelTable.workspaceId, member.workspace.id),
        eq(schema.labelTable.name, "Bug"),
      ),
    });
    expect(allLabels).toHaveLength(2);
    expect(allLabels.filter((l) => l.taskId === task.id)).toHaveLength(1);
  });

  it("does not republish task.label_assigned when re-attaching the same workspace label", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTask(member.user.id, project.id);

    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: null,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const first = await app.request(`/api/label/${label.id}/task`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    expect(first.status).toBe(200);

    recordedEvents.length = 0;

    const second = await app.request(`/api/label/${label.id}/task`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    expect(second.status).toBe(200);

    const assignedEvents = recordedEvents.filter(
      (e) => e.type === "task.label_assigned",
    );
    expect(assignedEvents).toHaveLength(0);
  });

  it("detaches a label by deleting the task assignment and leaves the workspace definition intact", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTask(member.user.id, project.id);

    const [workspaceLabel] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: null,
      })
      .returning();

    const [taskCopy] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: task.id,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const detachResponse = await app.request(`/api/label/${taskCopy.id}/task`, {
      method: "DELETE",
    });
    expect(detachResponse.status).toBe(200);

    const remaining = await db.query.labelTable.findMany({
      where: eq(schema.labelTable.workspaceId, member.workspace.id),
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(workspaceLabel.id);
    expect(remaining[0].taskId).toBeNull();
  });

  it("does not violate label_workspace_name_unique after detachment", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTask(member.user.id, project.id);

    const [workspaceLabel] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: null,
      })
      .returning();

    const [taskCopy] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: task.id,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const detachResponse = await app.request(`/api/label/${taskCopy.id}/task`, {
      method: "DELETE",
    });
    expect(detachResponse.status).toBe(200);

    const workspaceRows = await db.query.labelTable.findMany({
      where: and(
        eq(schema.labelTable.workspaceId, member.workspace.id),
        eq(schema.labelTable.name, "Bug"),
      ),
    });
    const workspaceDefinitions = workspaceRows.filter((l) => l.taskId === null);
    expect(workspaceDefinitions).toHaveLength(1);
    expect(workspaceDefinitions[0].id).toBe(workspaceLabel.id);

    await db.insert(schema.labelTable).values({
      name: "Bug",
      color: "#ef4444",
      workspaceId: member.workspace.id,
      taskId: task.id,
    });

    const reattachedRows = await db.query.labelTable.findMany({
      where: and(
        eq(schema.labelTable.workspaceId, member.workspace.id),
        eq(schema.labelTable.name, "Bug"),
      ),
    });
    const reattachedTaskRows = reattachedRows.filter((l) => l.taskId !== null);
    const reattachedWorkspaceRows = reattachedRows.filter(
      (l) => l.taskId === null,
    );

    expect(reattachedTaskRows).toHaveLength(1);
    expect(reattachedTaskRows[0].taskId).toBe(task.id);
    expect(reattachedWorkspaceRows).toHaveLength(1);
    expect(reattachedWorkspaceRows[0].id).toBe(workspaceLabel.id);
  });

  it("emits task.label_assigned and task.label_unassigned events through detach/attach", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTask(member.user.id, project.id);

    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: null,
      })
      .returning();

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const attachResponse = await app.request(`/api/label/${label.id}/task`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    expect(attachResponse.status).toBe(200);
    const attachPayload = (await attachResponse.json()) as { id: string };

    const detachResponse = await app.request(
      `/api/label/${attachPayload.id}/task`,
      { method: "DELETE" },
    );
    expect(detachResponse.status).toBe(200);

    const assignedEvents = recordedEvents.filter(
      (e) => e.type === "task.label_assigned",
    );
    const unassignedEvents = recordedEvents.filter(
      (e) => e.type === "task.label_unassigned",
    );

    expect(assignedEvents).toHaveLength(1);
    expect(unassignedEvents).toHaveLength(1);

    const assignedPayload = assignedEvents[0].data as {
      taskId: string;
      label: { id: string; name: string };
      task: { id: string };
      projectId: string;
      userId: string;
      type: string;
    };
    expect(assignedPayload.taskId).toBe(task.id);
    expect(assignedPayload.task.id).toBe(task.id);
    expect(assignedPayload.label.name).toBe("Bug");
    expect(assignedPayload.userId).toBe(member.user.id);
    expect(assignedPayload.type).toBe("label_assigned");

    const unassignedPayload = unassignedEvents[0].data as {
      taskId: string;
      label: { id: string; name: string };
      task: { id: string };
      projectId: string;
      userId: string;
      type: string;
    };
    expect(unassignedPayload.taskId).toBe(task.id);
    expect(unassignedPayload.label.id).toBe(attachPayload.id);
    expect(unassignedPayload.label.name).toBe("Bug");
    expect(unassignedPayload.type).toBe("label_unassigned");
  });

  it("bulk removeLabel deletes task-level copies without touching the workspace definition or unrelated labels", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

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

    const [bugLabel] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
        taskId: null,
      })
      .returning();

    const [featureLabel] = await db
      .insert(schema.labelTable)
      .values({
        name: "Feature",
        color: "#3b82f6",
        workspaceId: member.workspace.id,
        taskId: null,
      })
      .returning();

    await db.insert(schema.labelTable).values({
      name: "Bug",
      color: "#ef4444",
      workspaceId: member.workspace.id,
      taskId: taskA.id,
    });

    await db.insert(schema.labelTable).values({
      name: "Bug",
      color: "#ef4444",
      workspaceId: member.workspace.id,
      taskId: taskB.id,
    });

    await db.insert(schema.labelTable).values({
      name: "Feature",
      color: "#3b82f6",
      workspaceId: member.workspace.id,
      taskId: taskA.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskIds: [taskA.id, taskB.id],
        operation: "removeLabel",
        value: bugLabel.id,
      }),
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      updatedCount: number;
    };
    expect(payload.success).toBe(true);
    expect(payload.updatedCount).toBe(2);

    const remaining = await db.query.labelTable.findMany({
      where: eq(schema.labelTable.workspaceId, member.workspace.id),
    });

    const bugWorkspace = remaining.find(
      (l) => l.name === "Bug" && l.taskId === null,
    );
    const featureWorkspace = remaining.find(
      (l) => l.name === "Feature" && l.taskId === null,
    );
    const featureCopyA = remaining.find(
      (l) => l.name === "Feature" && l.taskId === taskA.id,
    );
    const bugCopies = remaining.filter(
      (l) => l.name === "Bug" && l.taskId !== null,
    );

    expect(bugWorkspace).toBeDefined();
    expect(bugWorkspace?.id).toBe(bugLabel.id);
    expect(bugCopies).toHaveLength(0);
    expect(featureWorkspace).toBeDefined();
    expect(featureWorkspace?.id).toBe(featureLabel.id);
    expect(featureCopyA).toBeDefined();

    const unassignedEvents = recordedEvents.filter(
      (e) => e.type === "task.label_unassigned",
    );
    expect(unassignedEvents).toHaveLength(2);

    const eventTaskIds = unassignedEvents
      .map((e) => (e.data as { taskId: string }).taskId)
      .sort();
    expect(eventTaskIds).toEqual([taskA.id, taskB.id].sort());

    for (const event of unassignedEvents) {
      const data = event.data as {
        label: { id: string; name: string };
        taskId: string;
        userId: string;
      };
      expect(data.label.name).toBe("Bug");
      expect(data.userId).toBe(member.user.id);
    }
  });
});
