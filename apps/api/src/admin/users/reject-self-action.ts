import { ApiError } from "../../errors/api-error";

/** Admins can't lock themselves out through the directory. */
export function rejectSelfAction(
  actorId: string,
  userId: string,
  code: string,
  message: string,
) {
  if (actorId === userId) throw new ApiError(400, { code, message });
}
