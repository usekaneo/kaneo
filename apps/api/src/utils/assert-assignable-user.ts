import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { findInaccessibleProjectIds } from "../project-access/find-inaccessible-project-ids";
import { instanceAdminRoleSql } from "./instance-admin-role";

export const NOT_ASSIGNABLE = "Assignee is not a member of this workspace";
export const NO_PROJECT_ACCESS =
  "Assignee does not have access to this project";

export async function filterAssignableUsers(
  userIds: string[],
  workspaceId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }

  const memberships = await database
    .select({ userId: schema.workspaceUserTable.userId })
    .from(schema.workspaceUserTable)
    .where(
      and(
        inArray(schema.workspaceUserTable.userId, userIds),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    );

  const assignable = new Set(memberships.map((row) => row.userId));
  const remaining = userIds.filter((id) => !assignable.has(id));

  if (remaining.length === 0) {
    return assignable;
  }

  const admins = await database
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(
      and(
        inArray(schema.userTable.id, remaining),
        instanceAdminRoleSql(schema.userTable.role),
      ),
    );

  for (const admin of admins) {
    assignable.add(admin.id);
  }

  return assignable;
}

export async function assertAssignableUser(
  userId: string,
  workspaceId: string,
  projectIds: string | readonly string[],
  database: Pick<typeof db, "select"> = db,
): Promise<void> {
  const assignable = await filterAssignableUsers(
    [userId],
    workspaceId,
    database,
  );

  if (!assignable.has(userId)) {
    throw new HTTPException(403, { message: NOT_ASSIGNABLE });
  }

  const ids = typeof projectIds === "string" ? [projectIds] : projectIds;
  if ((await findInaccessibleProjectIds(userId, ids, database)).length > 0) {
    throw new HTTPException(403, { message: NO_PROJECT_ACCESS });
  }
}

export async function getProjectWorkspaceId(
  projectId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<string> {
  const [project] = await database
    .select({ workspaceId: schema.projectTable.workspaceId })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  return project.workspaceId;
}
