import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("people overview", () => {
  it("sums workload, this month's time and this year's leave per person", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(schema.taskTable).values([
      {
        projectId: project.id,
        userId: alice.id,
        title: "Late",
        status: "to-do",
        columnId: columns.todo.id,
        dueDate: yesterday,
        number: 1,
      },
      {
        projectId: project.id,
        userId: alice.id,
        title: "On time",
        status: "to-do",
        columnId: columns.todo.id,
        dueDate: inAWeek,
        number: 2,
      },
      {
        projectId: project.id,
        userId: alice.id,
        title: "Finished",
        status: "done",
        columnId: columns.done.id,
        number: 3,
      },
      {
        projectId: project.id,
        title: "Nobody's",
        status: "to-do",
        columnId: columns.todo.id,
        number: 4,
      },
    ]);

    // 90 minutes, started now so it is always inside this month.
    const start = new Date();
    await db.insert(schema.attendanceSessionTable).values({
      workspaceId: workspace.id,
      userId: alice.id,
      clockIn: start,
      clockOut: new Date(start.getTime() + 90 * 60 * 1000),
    });

    const year = new Date().getUTCFullYear();
    await db.insert(schema.leaveRequestTable).values([
      {
        workspaceId: workspace.id,
        userId: alice.id,
        type: "annual",
        startDate: `${year}-01-10`,
        endDate: `${year}-01-11`,
        days: 2,
        status: "approved",
      },
      {
        workspaceId: workspace.id,
        userId: alice.id,
        type: "sick",
        startDate: `${year}-12-01`,
        endDate: `${year}-12-01`,
        days: 1,
        status: "pending",
      },
      {
        workspaceId: workspace.id,
        userId: alice.id,
        type: "unpaid",
        startDate: `${year}-02-01`,
        endDate: `${year}-02-03`,
        days: 3,
        status: "approved",
      },
    ]);

    const response = await requestAs(owner)(
      `/people/overview?workspaceId=${workspace.id}`,
    );
    expect(response.status).toBe(200);
    expect(response.json.unassignedOpenTasks).toBe(1);
    expect(
      response.json.people.find(
        (p: { userId: string }) => p.userId === alice.id,
      ),
    ).toMatchObject({
      openTasks: 2,
      overdueTasks: 1,
      workedMinutesThisMonth: 90,
      // Unpaid leave doesn't count against the allowance.
      leaveUsed: 2,
      leavePending: 1,
    });
  });

  it("reports a parent task's subtask progress in the person's task list", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [parent, doneChild, openChild] = await db
      .insert(schema.taskTable)
      .values([
        {
          projectId: project.id,
          userId: user.id,
          title: "Launch",
          status: "to-do",
          columnId: columns.todo.id,
          number: 1,
        },
        {
          projectId: project.id,
          title: "Write copy",
          status: "done",
          columnId: columns.done.id,
          number: 2,
        },
        {
          projectId: project.id,
          title: "Design banner",
          status: "to-do",
          columnId: columns.todo.id,
          number: 3,
        },
      ])
      .returning();
    await db.insert(schema.taskRelationTable).values(
      [doneChild, openChild].map((child) => ({
        sourceTaskId: parent.id,
        targetTaskId: child.id,
        relationType: "subtask",
      })),
    );

    const tasks = await requestAs(user)(
      `/people/${user.id}/tasks?workspaceId=${workspace.id}`,
    );
    expect(
      tasks.json.find((t: { id: string }) => t.id === parent.id),
    ).toMatchObject({ subtaskTotal: 2, subtaskDone: 1 });
  });

  it("is only for people who can see everyone", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const member = await addWorkspaceMember(workspace.id, "member", "Bob");

    const response = await requestAs(member)(
      `/people/overview?workspaceId=${workspace.id}`,
    );
    expect(response.status).toBe(403);
  });
});
