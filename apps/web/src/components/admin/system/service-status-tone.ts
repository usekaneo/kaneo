import type { StatusTone } from "@/components/settings/status-badge";
import type { ServiceStatus } from "@/fetchers/admin/system-types";

const tones: Record<ServiceStatus, StatusTone> = {
  ok: "success",
  warning: "warning",
  not_configured: "neutral",
  down: "destructive",
};

export function serviceStatusTone(status: ServiceStatus): StatusTone {
  return tones[status];
}
