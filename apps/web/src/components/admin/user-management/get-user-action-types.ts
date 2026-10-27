import type { InstancePermission } from "@kaneo/permissions";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import type { UserActionType } from "./pending-user-action";

type Options = {
  isSelf: boolean;
  /** False when password sign-in is turned off on the instance. */
  canSendPasswordReset: boolean;
  /** The viewer's instance permissions. */
  permissions: readonly InstancePermission[];
};

/** The confirmable actions a directory row offers, in menu order. */
export function getUserActionTypes(
  user: Pick<AdminUser, "emailVerified" | "banned" | "isAnonymous">,
  { isSelf, canSendPasswordReset, permissions }: Options,
): UserActionType[] {
  const types: UserActionType[] = [];
  if (!user.isAnonymous && permissions.includes("users:credentials")) {
    if (canSendPasswordReset) types.push("sendPasswordReset");
    if (!user.emailVerified)
      types.push("sendVerification", "markEmailVerified");
  }
  if (!isSelf) {
    if (permissions.includes("users:disable"))
      types.push(user.banned ? "reactivate" : "deactivate");
    if (permissions.includes("users:delete")) types.push("delete");
  }
  return types;
}
