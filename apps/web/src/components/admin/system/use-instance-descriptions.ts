import { useTranslation } from "react-i18next";
import type { AdminSystemStatus } from "@/fetchers/admin/system-types";

const REDIS_MODES = {
  standalone: "settings:adminSystem.instance.redisModes.standalone",
  sentinel: "settings:adminSystem.instance.redisModes.sentinel",
  cluster: "settings:adminSystem.instance.redisModes.cluster",
} as const;

export function useInstanceDescriptions(system: AdminSystemStatus) {
  const { t } = useTranslation();
  const { database, realtime, redis, storage } = system;
  const code = (value: string | null) => value ?? "UNKNOWN";

  const databaseDescription =
    database.status === "ok"
      ? [
          t("settings:adminSystem.instance.databaseVersion", {
            version: database.serverVersion ?? "?",
          }),
          database.migrationsApplied === null
            ? null
            : t("settings:adminSystem.instance.migrations", {
                count: database.migrationsApplied,
              }),
          database.latencyMs === null
            ? null
            : t("settings:adminSystem.instance.latency", {
                ms: database.latencyMs,
              }),
        ]
          .filter(Boolean)
          .join(" · ")
      : t("settings:adminSystem.instance.databaseDown", {
          code: code(database.errorCode),
        });

  const delivery =
    realtime.adapter === null
      ? t("settings:adminSystem.instance.realtimeNotStarted")
      : realtime.status === "warning"
        ? t("settings:adminSystem.instance.realtimeRedisDown")
        : realtime.adapter === "redis"
          ? t("settings:adminSystem.instance.realtimeRedis")
          : t("settings:adminSystem.instance.realtimeInMemory");
  const realtimeDescription = `${t(
    "settings:adminSystem.instance.realtimeConnections",
    { count: realtime.connections },
  )} · ${delivery}`;

  const redisDescription =
    redis.status === "not_configured"
      ? t("settings:adminSystem.instance.redisNotConfigured")
      : redis.status === "ok"
        ? t("settings:adminSystem.instance.redisOk", {
            mode: redis.mode ? t(REDIS_MODES[redis.mode]) : "",
          })
        : t("settings:adminSystem.instance.redisDown", {
            code: code(redis.errorCode),
          });

  const storageDescription =
    storage.status === "not_configured"
      ? t("settings:adminSystem.instance.storageNotConfigured")
      : storage.status === "ok"
        ? t("settings:adminSystem.instance.storageOk")
        : !storage.configured
          ? t("settings:adminSystem.instance.storageIncomplete")
          : storage.status === "warning"
            ? t("settings:adminSystem.instance.storageWarning", {
                code: code(storage.errorCode),
              })
            : t("settings:adminSystem.instance.storageDown", {
                code: code(storage.errorCode),
              });

  return {
    databaseDescription,
    realtimeDescription,
    redisDescription,
    storageDescription,
  };
}
