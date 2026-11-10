import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { statement } from "@kaneo/permissions";
import db from "../database";
import { projectTable } from "../database/schema";
import {
  withQuillsWorkspace,
  type Database,
  type QuillsActor,
} from "../database/quills/client";
import { assertProjectAccess } from "../project-access/assert-project-access";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";

export type QuillsAction = (typeof statement.quills)[number];

/** Project IDs must come from the feature's persisted relationship, never a caller's substitute. */
export async function withQuillsRequest<T>(
  c: Context,
  access: { action: QuillsAction; projectId?: string },
  work: (db: Database, actor: QuillsActor) => Promise<T>,
): Promise<T> {
  const userId = c.get("userId") as string | undefined;
  const workspaceId = c.get("workspaceId") as string | undefined;
  if (!userId) throw new HTTPException(401, { message: "Unauthorized" });
  if (!workspaceId)
    throw new HTTPException(400, { message: "Workspace is required" });
  await validateWorkspaceAccess(userId, workspaceId, c.get("apiKey")?.id);
  await requireWorkspacePermission({
    workspace: ["read"],
    quills: [access.action],
  })(c, async () => {});
  if (access.projectId) {
    const [project] = await db
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, access.projectId),
          eq(projectTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!project)
      throw new HTTPException(404, { message: "Project not found" });
    await assertProjectAccess(userId, project.id);
  }
  return withQuillsWorkspace({ userId, workspaceId }, work);
}
