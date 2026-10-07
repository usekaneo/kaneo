import { DEFAULT_ROLE_NAMES } from "@kaneo/permissions";
import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceRoleTable, workspaceTable } from "../../database/schema";

async function listWorkspaceRoles(workspaceId: string) {
  const [workspace] = await db
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  const custom = await db
    .select({ role: workspaceRoleTable.role })
    .from(workspaceRoleTable)
    .where(eq(workspaceRoleTable.workspaceId, workspaceId))
    .orderBy(asc(workspaceRoleTable.role));

  return [
    ...new Set([
      ...DEFAULT_ROLE_NAMES,
      ...custom.map((row) => row.role).filter((role) => role !== "owner"),
    ]),
  ];
}

export default listWorkspaceRoles;
