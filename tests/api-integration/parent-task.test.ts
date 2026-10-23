import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type Project = Awaited<ReturnType<typeof createProjectFixture>>;
type Card = { id: string; parentTask: unknown };

let taskNumber = 0;
async function addTask(project: Project, title: string) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.project.id,
      title,
      status: "to-do",
      columnId: project.columns.todo.id,
      number: ++taskNumber,
    })
    .returning();
  return task;
}

async function subtask(parentId: string, childId: string) {
  await db.insert(schema.taskRelationTable).values({
    sourceTaskId: parentId,
    targetTaskId: childId,
    relationType: "subtask",
  });
}

describe("API integration: parent task on cards", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    taskNumber = 0;
  });

  it("names a subtask's parent on project and global boards", async () => {
    const me = await createWorkspaceMember();
    const ami = await createProjectFixture({
      workspaceId: me.workspace.id,
      slug: "AMI",
    });
    const parent = await addTask(ami, "Dokończyć plan animacji");
    const child = await addTask(ami, "Storyboard");
    await subtask(parent.id, child.id);

    mockAuthenticatedSession(me.user);
    const { app } = createApp();
    const expected = {
      id: parent.id,
      number: parent.number,
      title: "Dokończyć plan animacji",
      projectSlug: "AMI",
    };

    const board = await (
      await app.request(`/api/task/tasks/${ami.project.id}`)
    ).json();
    const cards = board.data.columns.flatMap(
      (column: { tasks: Card[] }) => column.tasks,
    ) as Card[];
    expect(cards.find((card) => card.id === child.id)?.parentTask).toEqual(
      expected,
    );
    expect(cards.find((card) => card.id === parent.id)?.parentTask).toBeNull();

    const global = (await (
      await app.request("/api/task/global-board?globalStatus=to-do")
    ).json()) as { tasks: Card[] };
    expect(
      global.tasks.find((card) => card.id === child.id)?.parentTask,
    ).toEqual(expected);
  });

  it("hides a parent in a project the caller cannot open", async () => {
    const owner = await createWorkspaceMember();
    const open = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const secret = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const parent = await addTask(secret, "Secret plan");
    const child = await addTask(open, "Visible child");
    await subtask(parent.id, child.id);
    const member = await addWorkspaceMember(owner.workspace.id);
    await restrictToProjects(owner.workspace.id, member.id, [open.project.id]);

    mockAuthenticatedSession(member);
    const { app } = createApp();
    const board = await (
      await app.request(`/api/task/tasks/${open.project.id}`)
    ).json();
    const cards = board.data.columns.flatMap(
      (column: { tasks: Card[] }) => column.tasks,
    ) as Card[];
    expect(cards.find((card) => card.id === child.id)?.parentTask).toBeNull();
  });
});
