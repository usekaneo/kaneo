import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { ApiError } from "../../errors/api-error";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import { roleHasWorkspacePermission } from "../../utils/require-workspace-permission";
import { deleteWorkspaceData } from "./delete-workspace-data";
import type { AdminAuditRequest } from "../../admin/audit/admin-audit-request";

/** The native owner endpoint and instance-admin endpoint use one deletion path. */
export async function deleteNativeWorkspace(
  workspaceId: unknown,
  userId: string | undefined,
  request: Omit<AdminAuditRequest, "actorUserId">,
) {
  if (!userId) throw new APIError("UNAUTHORIZED");
  if (typeof workspaceId !== "string" || !workspaceId)
    throw new APIError("BAD_REQUEST", { message: "Workspace ID is required" });
  const [member] = await db
    .select({
      role: schema.workspaceUserTable.role,
      instanceRole: schema.userTable.role,
    })
    .from(schema.workspaceUserTable)
    .innerJoin(
      schema.userTable,
      eq(schema.userTable.id, schema.workspaceUserTable.userId),
    )
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    );
  if (
    !member ||
    !(await roleHasWorkspacePermission(workspaceId, member.role, {
      organization: ["delete"],
    }))
  )
    throw new APIError("FORBIDDEN", {
      message: "Workspace deletion permission is required",
    });
  try {
    const workspace = await deleteWorkspaceData(
      workspaceId,
      hasInstanceAdminRole(member.instanceRole)
        ? { ...request, actorUserId: userId }
        : undefined,
    );
    let metadata: unknown;
    try {
      metadata = workspace.metadata
        ? JSON.parse(workspace.metadata)
        : undefined;
    } catch {
      metadata = undefined;
    }
    // Preserve Better Auth's organization response contract.
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logo: workspace.logo,
      createdAt: workspace.createdAt,
      metadata,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409)
      throw new APIError("CONFLICT", {
        code: error.code,
        message: error.message,
      });
    throw error;
  }
}
