import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import db, { schema } from "../../../apps/api/src/database";
import { replaceMemberProjectAccess } from "../../../apps/api/src/project-access/member-project-access";
import { createProjectFixture, createWorkspaceMember } from "./fixtures";

export async function addWorkspaceMember(workspaceId: string, role = "member") {
  const userId = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: `Member ${role}`,
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

export async function restrictToProjects(
  workspaceId: string,
  userId: string,
  projectIds: string[],
) {
  await replaceMemberProjectAccess(db, {
    workspaceId,
    userId,
    projectAccess: "selected",
    projectIds,
  });
}

async function createTask(
  project: Awaited<ReturnType<typeof createProjectFixture>>,
  title: string,
  assigneeId: string,
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.project.id,
      title,
      status: project.columns.todo.slug,
      columnId: project.columns.todo.id,
      userId: assigneeId,
      number: 1,
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.project.id));
  return task;
}

export async function createRestrictedWorkspace() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const alpha = await createProjectFixture({
    workspaceId: workspace.id,
    name: "Alpha",
    slug: "alpha",
  });
  const beta = await createProjectFixture({
    workspaceId: workspace.id,
    name: "Beta",
    slug: "beta",
  });
  const restricted = await addWorkspaceMember(workspace.id);
  await restrictToProjects(workspace.id, restricted.id, [alpha.project.id]);

  const alphaTask = await createTask(
    alpha,
    "Visible alpha task",
    restricted.id,
  );
  const betaTask = await createTask(beta, "Hidden beta task", restricted.id);

  return {
    owner,
    workspace,
    restricted,
    alpha: alpha.project,
    beta: beta.project,
    alphaTask,
    betaTask,
  };
}
