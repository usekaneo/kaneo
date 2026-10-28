import type { Context, Next } from "hono";
import { ApiError } from "../errors/api-error";
import getManagedProfile from "./controllers/get-managed-profile";
import {
  canRemoveAvatar,
  PROFILE_FIELD_MANAGED_BY_PROVIDER,
} from "./managed-profile";

export async function requireUnmanagedAvatar(c: Context, next: Next) {
  const managed = await getManagedProfile(c.get("userId"));
  if (managed?.fields.includes("image")) {
    throw new ApiError(403, { ...PROFILE_FIELD_MANAGED_BY_PROVIDER });
  }
  return next();
}

export async function requireRemovableAvatar(c: Context, next: Next) {
  const managed = await getManagedProfile(c.get("userId"));
  if (
    managed?.fields.includes("image") &&
    !canRemoveAvatar(managed.stored.image)
  ) {
    throw new ApiError(403, { ...PROFILE_FIELD_MANAGED_BY_PROVIDER });
  }
  return next();
}
