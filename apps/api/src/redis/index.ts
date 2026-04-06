import Redis from "ioredis";

let _redisPub: Redis | null = null;
let _redisSub: Redis | null = null;

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set — cannot create Redis client");
  }
  return url;
}

export function getRedisPub(): Redis {
  if (!_redisPub) {
    _redisPub = new Redis(getRedisUrl());
    _redisPub.on("error", (err) =>
      console.error("Redis pub client error:", err),
    );
  }
  return _redisPub;
}

export function getRedisSub(): Redis {
  if (!_redisSub) {
    _redisSub = new Redis(getRedisUrl());
    _redisSub.on("error", (err) =>
      console.error("Redis sub client error:", err),
    );
  }
  return _redisSub;
}

export async function closeRedis(): Promise<void> {
  if (_redisPub) {
    await _redisPub.quit();
    _redisPub = null;
  }
  if (_redisSub) {
    await _redisSub.quit();
    _redisSub = null;
  }
}
