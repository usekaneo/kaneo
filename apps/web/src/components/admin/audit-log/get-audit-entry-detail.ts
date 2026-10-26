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
    default:
      return null;
  }
}
