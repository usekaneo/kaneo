const ACTION_LABEL_KEYS = new Map([
  ["user.created", "settings:adminAuditLog.actions.userCreated"],
  ["user.updated", "settings:adminAuditLog.actions.userUpdated"],
  ["user.role_changed", "settings:adminAuditLog.actions.userRoleChanged"],
  ["user.deactivated", "settings:adminAuditLog.actions.userDeactivated"],
  ["user.reactivated", "settings:adminAuditLog.actions.userReactivated"],
  ["user.deleted", "settings:adminAuditLog.actions.userDeleted"],
  ["user.password_set", "settings:adminAuditLog.actions.userPasswordSet"],
  ["user.impersonated", "settings:adminAuditLog.actions.userImpersonated"],
  ["session.revoked", "settings:adminAuditLog.actions.sessionRevoked"],
  ["session.revoked_all", "settings:adminAuditLog.actions.sessionRevokedAll"],
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
