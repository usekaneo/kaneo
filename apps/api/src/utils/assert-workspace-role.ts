import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";

export type WorkspaceRole = "owner" | "admin" | "member";

export async function assertWorkspaceRole(options: {
  workspaceId: string;
  userId: string;
  allowedRoles: WorkspaceRole[];
}): Promise<void> {
  const membership = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, options.workspaceId),
        eq(schema.workspaceUserTable.userId, options.userId),
      ),
    )
    .limit(1);

  const role = membership[0]?.role as WorkspaceRole | undefined;

  if (!role) {
    throw new HTTPException(403, {
      message: "You don't have access to this workspace",
    });
  }

  if (!options.allowedRoles.includes(role)) {
    throw new HTTPException(403, {
      message: "You don't have permission to manage projects in this workspace",
    });
  }
}
