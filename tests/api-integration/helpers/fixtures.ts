import { randomUUID } from "node:crypto";
import db, { schema } from "../../../apps/api/src/database";

export type SeededMemberContext = {
  user: typeof schema.userTable.$inferSelect;
  workspace: typeof schema.workspaceTable.$inferSelect;
};

export async function createWorkspaceMember(
  overrides?: Partial<{
    userName: string;
    workspaceName: string;
    role: string;
  }>,
): Promise<SeededMemberContext> {
  const userId = `user-${randomUUID()}`;
  const workspaceId = `workspace-${randomUUID()}`;

  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: overrides?.userName || "Integration Test User",
    })
    .returning();

  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: workspaceId,
      createdAt: new Date(),
      name: overrides?.workspaceName || "Integration Test Workspace",
      slug: `workspace-${randomUUID()}`,
    })
    .returning();

  await db.insert(schema.workspaceUserTable).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: overrides?.role || "owner",
    joinedAt: new Date(),
  });

  return { user, workspace };
}

export async function createProjectFixture({
  workspaceId,
  name = "Integration Project",
  icon = "Folder",
  slug = `project-${randomUUID()}`,
}: {
  workspaceId: string;
  name?: string;
  icon?: string;
  slug?: string;
}) {
  const [project] = await db
    .insert(schema.projectTable)
    .values({
      workspaceId,
      name,
      icon,
      slug,
    })
    .returning();

  const [todoColumn] = await db
    .insert(schema.columnTable)
    .values({
      projectId: project.id,
      name: "To Do",
      slug: "to-do",
      position: 0,
      isFinal: false,
    })
    .returning();

  const [doneColumn] = await db
    .insert(schema.columnTable)
    .values({
      projectId: project.id,
      name: "Done",
      slug: "done",
      position: 1,
      isFinal: true,
    })
    .returning();

  return {
    project,
    columns: {
      todo: todoColumn,
      done: doneColumn,
    },
  };
}
