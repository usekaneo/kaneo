import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import db from "../database";
import { workspaceTable, workspaceUserTable } from "../database/schema";

type PermissionLevel = "owner" | "member";

export async function checkWorkspacePermission(
  userEmail: string,
  workspaceId: string,
  requiredRole: PermissionLevel = "member",
): Promise<boolean> {
  const [workspace] = await db
    .select()
    .from(workspaceTable)
    .where(
      and(
        eq(workspaceTable.id, workspaceId),
        eq(workspaceTable.ownerEmail, userEmail),
      ),
    )
    .limit(1);

  if (workspace) return true;
  if (requiredRole === "owner") return false;

  const [member] = await db
    .select()
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userEmail, userEmail),
        eq(workspaceUserTable.status, "active"),
      ),
    )
    .limit(1);

  return Boolean(member);
}

export const requireWorkspacePermission = (
  requiredRole: PermissionLevel = "member",
) =>
  new Elysia()
    .state("userEmail", "" as string)
    .derive(async ({ store, params, set }) => {
      const userEmail = store.userEmail;

      let workspaceId: string | undefined;

      if (typeof params === "object" && params !== null) {
        if ("workspaceId" in params && typeof params.workspaceId === "string") {
          workspaceId = params.workspaceId;
        } else if ("id" in params && typeof params.id === "string") {
          workspaceId = params.id;
        }
      }

      if (!workspaceId) {
        set.status = 400;
        throw new Error("Workspace ID is required");
      }

      const hasPermission = await checkWorkspacePermission(
        userEmail,
        workspaceId,
        requiredRole,
      );

      if (!hasPermission) {
        set.status = 403;
        throw new Error(
          requiredRole === "owner"
            ? "Only workspace owners can perform this action"
            : "You don't have permission to access this workspace",
        );
      }
    });
