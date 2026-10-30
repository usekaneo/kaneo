import { APIError } from "better-auth/api";
import { parseManagedProfileFields } from "../../utils/custom-oauth-env";
import {
  changesManagedProfile,
  PROFILE_FIELD_MANAGED_BY_PROVIDER,
} from "../managed-profile";
import getManagedProfile from "./get-managed-profile";

type UpdateHookContext = {
  path?: string;
  body?: { userId?: unknown };
  context?: { session?: { user: { id: string } } | null };
};

function getEditedUserId(ctx: UpdateHookContext | null | undefined) {
  if (ctx?.path === "/update-user") return ctx.context?.session?.user.id;
  if (ctx?.path === "/admin/update-user") return ctx.body?.userId;
  return undefined;
}

export async function assertManagedProfileUnchanged(
  data: Record<string, unknown>,
  ctx: UpdateHookContext | null | undefined,
) {
  const userId = getEditedUserId(ctx);
  if (
    typeof userId !== "string" ||
    !parseManagedProfileFields().some((field) => data[field] !== undefined)
  ) {
    return;
  }
  const managed = await getManagedProfile(userId);
  if (managed && changesManagedProfile(data, managed.stored, managed.fields)) {
    throw new APIError("FORBIDDEN", { ...PROFILE_FIELD_MANAGED_BY_PROVIDER });
  }
}

export default assertManagedProfileUnchanged;
