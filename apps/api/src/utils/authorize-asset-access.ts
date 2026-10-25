import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertProjectAccess } from "../project-access/assert-project-access";
import { resolveAssetBearerOrCookie } from "./authenticate-api-request";
import { validateWorkspaceAccess } from "./validate-workspace-access";
import { workspacePermissionGrants } from "./workspace-permission-grants";

type AssetAccessTarget = {
  workspaceId: string;
  projectId: string;
  isPublic: boolean | null;
  surface: string;
  createdBy?: string | null;
};

/** Only description assets belong to the public project representation. */
export function isPublicAsset(asset: AssetAccessTarget): boolean {
  return asset.isPublic === true && asset.surface === "description";
}

export async function authorizeAssetAccess(
  c: Context,
  asset: AssetAccessTarget,
): Promise<void> {
  if (isPublicAsset(asset)) {
    return;
  }

  const { userId, apiKeyId, apiKeyPermissions } =
    await resolveAssetBearerOrCookie(c);
  await validateWorkspaceAccess(userId, asset.workspaceId, apiKeyId, {
    notFoundMessage: "Asset not found",
  });
  if (asset.surface.startsWith("draft") && asset.createdBy !== userId)
    throw new HTTPException(403, {
      message: "Staged uploads are private to their owner",
    });
  await assertProjectAccess(userId, asset.projectId);
  const grants = await workspacePermissionGrants(userId, {
    apiKeyPermissions,
    workspaceIds: [asset.workspaceId],
  });
  // Drafts are the uploader's task-creation preview, before a task exists.
  const permissions = {
    task: [asset.surface.startsWith("draft") ? "create" : "read"],
  };
  if (!grants.allows(asset.workspaceId, permissions)) {
    throw new HTTPException(403, { message: "Insufficient asset permissions" });
  }
}
