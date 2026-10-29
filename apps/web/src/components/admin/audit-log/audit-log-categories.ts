/** Filter values are action prefixes understood by the audit log API. */
export const AUDIT_LOG_CATEGORIES = [
  { value: "", labelKey: "settings:adminAuditLog.categories.all" },
  { value: "user", labelKey: "settings:adminAuditLog.categories.user" },
  { value: "email", labelKey: "settings:adminAuditLog.categories.email" },
  { value: "session", labelKey: "settings:adminAuditLog.categories.session" },
  { value: "api_key", labelKey: "settings:adminAuditLog.categories.apiKey" },
  {
    value: "workspace",
    labelKey: "settings:adminAuditLog.categories.workspace",
  },
  { value: "role", labelKey: "settings:adminAuditLog.categories.role" },
  {
    value: "instance",
    labelKey: "settings:adminAuditLog.categories.instance",
  },
  { value: "webhook", labelKey: "settings:adminAuditLog.categories.webhook" },
] as const;
