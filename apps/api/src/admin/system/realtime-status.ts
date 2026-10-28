import type { ServiceStatus } from "./service-status";

type RealtimeStatusInput = {
  adapter: "redis" | "in-memory" | null;
  redisStatus: ServiceStatus;
};

/**
 * Sockets on this instance keep working while Redis is down; only delivery
 * to clients on other instances stops. Without an adapter nothing is sent.
 */
export function realtimeStatus({
  adapter,
  redisStatus,
}: RealtimeStatusInput): ServiceStatus {
  if (adapter === null) return "down";
  if (adapter === "redis" && redisStatus !== "ok") return "warning";
  return "ok";
}
