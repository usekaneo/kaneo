import {
  getRedisPub,
  getRedisSub,
  isRedisConfigured,
  resolveRedisMode,
} from "../../redis";
import { safeErrorCode } from "./safe-error-code";
import type { ServiceStatus } from "./service-status";
import { withTimeout } from "./with-timeout";

type RedisProbe = {
  status: ServiceStatus;
  mode: "standalone" | "sentinel" | "cluster" | null;
  errorCode: string | null;
};

// Redis only fans realtime events out across API instances. A single
// instance runs without it, so "not configured" is a healthy answer.
export async function probeRedis(timeoutMs: number): Promise<RedisProbe> {
  if (!isRedisConfigured()) {
    return { status: "not_configured", mode: null, errorCode: null };
  }

  let mode: RedisProbe["mode"];
  try {
    mode = resolveRedisMode().mode;
  } catch {
    return { status: "down", mode: null, errorCode: "INVALID_CONFIG" };
  }

  try {
    await withTimeout(() => getRedisPub().ping(), timeoutMs);
    if (getRedisSub().status !== "ready") {
      return { status: "down", mode, errorCode: "SUBSCRIBER_NOT_READY" };
    }
    return { status: "ok", mode, errorCode: null };
  } catch (error) {
    return { status: "down", mode, errorCode: safeErrorCode(error) };
  }
}
