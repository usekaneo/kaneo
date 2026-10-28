import { z } from "../../openapi";

export const SERVICE_STATUSES = [
  "ok",
  "warning",
  "not_configured",
  "down",
] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const serviceStatusSchema = z.enum(SERVICE_STATUSES).openapi({
  description:
    "ok: working. warning: works with a problem, or is only partly configured. not_configured: optional and switched off, which is a healthy state. down: configured but not reachable.",
});
