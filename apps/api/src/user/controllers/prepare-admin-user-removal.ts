import { APIError, getSessionFromCtx } from "better-auth/api";
import deleteAccountData from "./delete-account-data";

type RemovalContext = Parameters<typeof getSessionFromCtx>[0];

function hasAdminRole(role: unknown) {
  return (
    typeof role === "string" &&
    role
      .split(",")
      .map((entry) => entry.trim())
      .includes("admin")
  );
}

export async function prepareAdminUserRemoval(ctx: RemovalContext) {
  const session = await getSessionFromCtx(ctx, {
    disableCookieCache: true,
    disableRefresh: true,
  }).catch(() => null);
  const caller = session?.user as { id: string; role?: unknown } | undefined;

  if (!caller || !hasAdminRole(caller.role)) {
    throw new APIError("FORBIDDEN", {
      message: "Only instance administrators can remove users.",
    });
  }

  const userId = (ctx.body as { userId?: unknown } | undefined)?.userId;
  if (typeof userId !== "string" || userId === "") {
    return;
  }

  if (userId === caller.id) {
    throw new APIError("BAD_REQUEST", {
      message: "You cannot remove yourself.",
    });
  }

  await deleteAccountData(userId);
}

export default prepareAdminUserRemoval;
