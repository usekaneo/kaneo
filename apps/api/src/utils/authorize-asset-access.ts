import type { Context } from "hono";
import { resolveAssetBearerOrCookie } from "./authenticate-api-request";
import { validateWorkspaceAccess } from "./validate-workspace-access";

type AssetAccessTarget = {
  workspaceId: string;
  isPublic: boolean | null;
};

/**
 * Authorizes a request for a stored asset.
 *
 * Assets that belong to a public project are readable by anyone, so the
 * credential check must be skipped entirely for them:
 * `resolveAssetBearerOrCookie` throws a 401 for anonymous callers rather than
 * returning an empty user, so calling it first makes the public case
 * unreachable.
 */
export async function authorizeAssetAccess(
  c: Context,
  asset: AssetAccessTarget,
): Promise<void> {
  if (asset.isPublic) {
    return;
  }

  const { userId, apiKeyId } = await resolveAssetBearerOrCookie(c);
  await validateWorkspaceAccess(userId, asset.workspaceId, apiKeyId);
}
