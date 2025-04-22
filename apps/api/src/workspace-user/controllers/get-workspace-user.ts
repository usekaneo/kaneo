import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

async function getWorkspaceUser(id: string) {
  const workspaceUser = await db.query.workspaceUserTable.findFirst({
    where: eq(workspaceUserTable.id, id),
  });

  if (!workspaceUser) {
    throw new HTTPException(404, {
      message: "Workspace user not found",
    });
  }

  return workspaceUser;
}

export default getWorkspaceUser;
