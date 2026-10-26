import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import type { UserActionType } from "./pending-user-action";

type Options = {
  isSelf: boolean;
  /** False when password sign-in is turned off on the instance. */
  canSendPasswordReset: boolean;
};

/** The confirmable actions a directory row offers, in menu order. */
export function getUserActionTypes(
  user: Pick<AdminUser, "emailVerified" | "banned">,
  { isSelf, canSendPasswordReset }: Options,
): UserActionType[] {
  const types: UserActionType[] = [];
  if (canSendPasswordReset) types.push("sendPasswordReset");
  if (!user.emailVerified) types.push("sendVerification", "markEmailVerified");
  if (!isSelf) {
    types.push(user.banned ? "reactivate" : "deactivate", "delete");
  }
  return types;
}
