import type { getAdminSystemStatus } from "./get-admin-system-status";

export type AdminSystemStatus = Awaited<
  ReturnType<typeof getAdminSystemStatus>
>;

export type ServiceStatus = AdminSystemStatus["api"]["status"];
