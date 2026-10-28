const TARGET_TYPE_LABEL_KEYS = new Map([
  ["webhook", "settings:adminAuditLog.targetTypes.webhook"],
  ["user", "settings:adminAuditLog.targetTypes.user"],
  ["workspace", "settings:adminAuditLog.targetTypes.workspace"],
  ["role", "settings:adminAuditLog.targetTypes.role"],
  ["instance", "settings:adminAuditLog.targetTypes.instance"],
]);

export function getAuditTargetTypeLabel(
  targetType: string,
  t: (key: string) => string,
) {
  const key = TARGET_TYPE_LABEL_KEYS.get(targetType);
  return key ? t(key) : targetType;
}
