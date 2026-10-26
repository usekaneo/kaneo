import { readAppVersion } from "../../app-version";
import { getLocalRealtimeStats } from "../../ws";
import { describeAuth } from "../system/describe-auth";
import { listIntegrationProviders } from "../system/list-integration-providers";
import { probeDatabase } from "../system/probe-database";
import { probeEmail } from "../system/probe-email";
import { probeRedis } from "../system/probe-redis";
import { probeStorage } from "../system/probe-storage";
import { realtimeStatus } from "../system/realtime-status";

const PROBE_TIMEOUT_MS = 3_000;

async function getSystemStatus() {
  const [database, redis, email, storage, integrations] = await Promise.all([
    probeDatabase(PROBE_TIMEOUT_MS),
    probeRedis(PROBE_TIMEOUT_MS),
    probeEmail(PROBE_TIMEOUT_MS),
    probeStorage(PROBE_TIMEOUT_MS),
    listIntegrationProviders(PROBE_TIMEOUT_MS),
  ]);
  const realtime = getLocalRealtimeStats();

  return {
    checkedAt: new Date().toISOString(),
    version: readAppVersion(),
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
    auth: describeAuth(),
    integrations,
  };
}

export default getSystemStatus;
