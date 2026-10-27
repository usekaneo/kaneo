import type { z } from "../../openapi";
import type { getServiceStatus } from "../system/get-service-status";
import type { overviewWarningSchema } from "./response";

type Warning = z.infer<typeof overviewWarningSchema>;

export function configurationWarnings(
  services: Awaited<ReturnType<typeof getServiceStatus>>,
  registration: boolean,
  enabledAdmins: number,
): Warning[] {
  const warnings: Warning[] = [];
  if (!services.email.configured) warnings.push("smtp_not_configured");
  else if (services.email.status === "down") warnings.push("smtp_unreachable");
  if (services.redis.status === "down" || services.redis.status === "warning") {
    warnings.push("redis_unreachable");
  }
  if (services.storage.errorCode === "INCOMPLETE_CONFIG")
    warnings.push("storage_incomplete");
  else if (
    services.storage.status === "down" ||
    services.storage.status === "warning"
  ) {
    warnings.push("storage_unreachable");
  }
  if (registration && !services.email.configured)
    warnings.push("registration_without_email");
  if (enabledAdmins < 2) warnings.push("no_second_admin");
  return warnings;
}
