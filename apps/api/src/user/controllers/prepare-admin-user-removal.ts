import { APIError, getSessionFromCtx } from "better-auth/api";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import deleteAccountData from "./delete-account-data";

type RemovalContext = Parameters<typeof getSessionFromCtx>[0];

export async function prepareAdminUserRemoval(ctx: RemovalContext) {
  const session = await getSessionFromCtx(ctx, {
    disableCookieCache: true,
    disableRefresh: true,
  });
  const caller = session?.user as { id: string; role?: unknown } | undefined;

  if (!caller || !hasInstanceAdminRole(caller.role)) {
    throw new APIError("FORBIDDEN", {
      code: "INSTANCE_ADMIN_REQUIRED",
      message: "Only instance administrators can remove users.",
    });
  }

  const userId = (ctx.body as { userId?: unknown } | undefined)?.userId;
  if (typeof userId !== "string" || userId === "") {
    return;
  }

  if (userId === caller.id) {
    throw new APIError("BAD_REQUEST", {
      code: "CANNOT_REMOVE_YOURSELF",
      message: "You cannot remove yourself.",
    });
  }

  await deleteAccountData(userId);
}

export default prepareAdminUserRemoval;
