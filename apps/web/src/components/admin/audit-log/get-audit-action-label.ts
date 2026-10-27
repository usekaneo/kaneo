const ACTION_LABEL_KEYS = new Map([
  ["user.created", "settings:adminAuditLog.actions.userCreated"],
  ["user.updated", "settings:adminAuditLog.actions.userUpdated"],
  ["user.role_changed", "settings:adminAuditLog.actions.userRoleChanged"],
  ["user.deactivated", "settings:adminAuditLog.actions.userDeactivated"],
  ["user.reactivated", "settings:adminAuditLog.actions.userReactivated"],
  ["user.deleted", "settings:adminAuditLog.actions.userDeleted"],
  ["user.password_set", "settings:adminAuditLog.actions.userPasswordSet"],
  ["user.impersonated", "settings:adminAuditLog.actions.userImpersonated"],
  [
    "user.password_reset_sent",
    "settings:adminAuditLog.actions.userPasswordResetSent",
  ],
  [
    "user.verification_sent",
    "settings:adminAuditLog.actions.userVerificationSent",
  ],
  ["user.email_verified", "settings:adminAuditLog.actions.userEmailVerified"],
  ["user.avatar_changed", "settings:adminAuditLog.actions.userAvatarChanged"],
  ["user.avatar_removed", "settings:adminAuditLog.actions.userAvatarRemoved"],
  ["session.revoked", "settings:adminAuditLog.actions.sessionRevoked"],
  ["session.revoked_all", "settings:adminAuditLog.actions.sessionRevokedAll"],
  ["api_key.revoked", "settings:adminAuditLog.actions.apiKeyRevoked"],
  [
    "workspace.member_added",
    "settings:adminAuditLog.actions.workspaceMemberAdded",
  ],
  [
    "workspace.member_removed",
    "settings:adminAuditLog.actions.workspaceMemberRemoved",
  ],
  [
    "workspace.member_role_changed",
    "settings:adminAuditLog.actions.workspaceMemberRoleChanged",
  ],
  [
    "workspace.owner_transferred",
    "settings:adminAuditLog.actions.workspaceOwnerTransferred",
  ],
]);

/** Human wording for an action; actions this client doesn't know show as-is. */
export function getAuditActionLabel(
  action: string,
  t: (key: string) => string,
) {
  const key = ACTION_LABEL_KEYS.get(action);
  return key ? t(key) : action;
}
