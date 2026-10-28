import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";
import { assertProjectAccess } from "../../project-access/assert-project-access";
import { findWorkspaceProjectIds } from "../../project-access/find-workspace-project-ids";
import { projectAccessCondition } from "../../project-access/project-access-condition";

async function getWorkspaceMembers(request: {
  workspaceId: string;
  userId: string;
  projectId?: string;
}) {
  const { workspaceId, projectId } = request;

  if (projectId) {
    const [known] = await findWorkspaceProjectIds(workspaceId, [projectId]);
    if (!known) {
      throw new HTTPException(404, { message: "Project not found" });
    }
    await assertProjectAccess(request.userId, projectId);
  }

  const members = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        projectId
          ? projectAccessCondition(workspaceUserTable.userId, projectId)
          : undefined,
      ),
    );

  return members;
}

export default getWorkspaceMembers;
