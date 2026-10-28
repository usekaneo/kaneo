import type { ServiceStatus } from "./service-status";

/**
 * A feature that needs several settings is configured when all are present,
 * not configured when none are, and a configuration warning in between.
 */
export function credentialSetStatus(values: unknown[]): ServiceStatus {
  const present = values.filter(
    (value) => typeof value === "string" && value.trim() !== "",
  ).length;
  if (present === 0) return "not_configured";
  return present === values.length ? "ok" : "warning";
}
