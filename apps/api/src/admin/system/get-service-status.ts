import { getLocalRealtimeStats } from "../../ws";
import { probeDatabase } from "./probe-database";
import { probeEmail } from "./probe-email";
import { probeRedis } from "./probe-redis";
import { probeStorage } from "./probe-storage";
import { realtimeStatus } from "./realtime-status";

const PROBE_TIMEOUT_MS = 3_000;

export async function getServiceStatus() {
  const [database, redis, email, storage] = await Promise.all([
    probeDatabase(PROBE_TIMEOUT_MS),
    probeRedis(PROBE_TIMEOUT_MS),
    probeEmail(PROBE_TIMEOUT_MS),
    probeStorage(PROBE_TIMEOUT_MS),
  ]);
  const realtime = getLocalRealtimeStats();
  return {
    checkedAt: new Date().toISOString(),
    api: {
      status: "ok" as const,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
    },
    database,
    realtime: {
      status: realtimeStatus({
        adapter: realtime.adapter,
        redisStatus: redis.status,
      }),
      ...realtime,
    },
    redis,
    email,
    storage,
  };
}
