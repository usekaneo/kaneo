import { getWorkspaceRoleLabel } from "@/components/admin/workspace-management/get-workspace-role-label";

type Translate = (key: string, values?: Record<string, unknown>) => string;

type Entry = {
  action: string;
  metadata: Record<string, unknown> | null;
};

const INSTANCE_ROLE_LABEL_KEYS = new Map([
  ["admin", "settings:adminUsers.roles.admin"],
  ["user", "settings:adminUsers.roles.user"],
]);

const FIELD_LABEL_KEYS = new Map([
  ["name", "settings:adminAuditLog.fields.name"],
  ["email", "settings:adminAuditLog.fields.email"],
  ["emailVerified", "settings:adminAuditLog.fields.emailVerified"],
  ["image", "settings:adminAuditLog.fields.image"],
]);

const SETTING_LABEL_KEYS = new Map([
  ["instanceName", "settings:adminSettings.instanceName"],
  ["registrationEnabled", "settings:adminSettings.registrationEnabled"],
  [
    "passwordRegistrationEnabled",
    "settings:adminSettings.passwordRegistrationEnabled",
  ],
  [
    "requireEmailVerification",
    "settings:adminSettings.requireEmailVerification",
  ],
  ["defaultRole", "settings:adminSettings.defaultRole"],
  [
    "workspaceCreationRestricted",
    "settings:adminSettings.workspaceCreationRestricted",
  ],
  ["disabledIntegrations", "settings:adminSettings.integrations"],
]);

const text = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : null;

function instanceRole(role: unknown, t: Translate) {
  const value = text(role);
  if (!value) return t("settings:adminAuditLog.details.noRole");
  return value
    .split(",")
    .map((name) => {
      const key = INSTANCE_ROLE_LABEL_KEYS.get(name);
      return key ? t(key) : name;
    })
    .join(", ");
}

function memberName(metadata: Record<string, unknown>) {
  const member = metadata.member as Record<string, unknown> | undefined;
  return text(member?.name) ?? text(member?.email) ?? text(member?.id);
}

/** A short, translated summary of what changed, when the entry says more. */
export function getAuditEntryDetail(
  { action, metadata }: Entry,
  t: Translate,
): string | null {
  if (!metadata) return null;
  const workspaceRole = (role: unknown) =>
    getWorkspaceRoleLabel(text(role) ?? "", t);

  switch (action) {
    case "user.created":
      return metadata.role === undefined
        ? null
        : t("settings:adminAuditLog.details.createdWithRole", {
            role: instanceRole(metadata.role, t),
          });
    case "user.role_changed":
      return t("settings:adminAuditLog.details.change", {
        from: instanceRole(metadata.from, t),
        to: instanceRole(metadata.to, t),
      });
    case "user.updated": {
      const fields = Array.isArray(metadata.fields) ? metadata.fields : [];
      const names = fields
        .filter((field): field is string => typeof field === "string")
        .map((field) => {
          const key = FIELD_LABEL_KEYS.get(field);
          return key ? t(key) : field;
        });
      return names.length > 0
        ? t("settings:adminAuditLog.details.fields", {
            fields: names.join(", "),
          })
        : null;
    }
    case "user.deactivated": {
      const reason = text(metadata.reason);
      return reason
        ? t("settings:adminAuditLog.details.reason", { reason })
        : null;
    }
    case "user.deleted":
      return text(metadata.name);
    case "session.revoked_all":
      return typeof metadata.count === "number"
        ? t("settings:adminAuditLog.details.sessionCount", {
            count: metadata.count,
          })
        : null;
    case "api_key.revoked":
      return text(metadata.keyName);
    case "workspace.member_added":
      return t("settings:adminAuditLog.details.memberWithRole", {
        member: memberName(metadata),
        role: workspaceRole(metadata.role),
      });
    case "workspace.member_role_changed":
      return t("settings:adminAuditLog.details.memberChange", {
        member: memberName(metadata),
        from: workspaceRole(metadata.previousRole),
        to: workspaceRole(metadata.role),
      });
    case "workspace.member_removed":
    case "workspace.owner_transferred":
      return memberName(metadata);
    case "workspace.deleted":
      return typeof metadata.memberCount === "number" &&
        typeof metadata.projectCount === "number"
        ? t("settings:adminAuditLog.details.workspaceContents", {
            members: metadata.memberCount,
            projects: metadata.projectCount,
          })
        : null;
    case "role.created":
    case "role.deleted":
      return Array.isArray(metadata.permissions)
        ? t("settings:adminRoles.permissionCount", {
            count: metadata.permissions.length,
          })
        : null;
    case "role.updated": {
      const name = metadata.name as Record<string, unknown> | undefined;
      if (name) {
        return t("settings:adminAuditLog.details.change", {
          from: text(name.from),
          to: text(name.to),
        });
      }
      return Array.isArray(metadata.added) && Array.isArray(metadata.removed)
        ? t("settings:adminAuditLog.details.permissionsChanged", {
            added: metadata.added.length,
            removed: metadata.removed.length,
          })
        : null;
    }
    case "instance.settings_updated": {
      const changes = Array.isArray(metadata.changes) ? metadata.changes : [];
      const names = changes
        .map((change) => text((change as { setting?: unknown })?.setting))
        .filter((setting): setting is string => setting !== null)
        .map((setting) => {
          const key = SETTING_LABEL_KEYS.get(setting);
          return key ? t(key) : setting;
        });
      return names.length > 0
        ? t("settings:adminAuditLog.details.fields", {
            fields: names.join(", "),
          })
        : null;
    }
    default:
      return null;
  }
}
