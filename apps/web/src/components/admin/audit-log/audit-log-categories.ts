/** Filter values are action prefixes understood by the audit log API. */
export const AUDIT_LOG_CATEGORIES = [
  { value: "", labelKey: "settings:adminAuditLog.categories.all" },
  { value: "user", labelKey: "settings:adminAuditLog.categories.user" },
  { value: "session", labelKey: "settings:adminAuditLog.categories.session" },
  {
    value: "workspace",
    labelKey: "settings:adminAuditLog.categories.workspace",
  },
] as const;
