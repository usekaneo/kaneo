export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  interval: number;
  expires_in: number;
};

export type DeviceTokenErrorBody = {
  error?: string;
  error_description?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function requestDeviceCode(
  baseUrl: string,
  clientId: string,
): Promise<DeviceCodeResponse> {
  const res = await fetch(`${baseUrl}/api/auth/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId }),
  });
  const body = (await res.json().catch(() => ({}))) as
    | DeviceCodeResponse
    | DeviceTokenErrorBody;
  if (!res.ok) {
    throw new Error(
      `device/code failed (${res.status}): ${JSON.stringify(body)}`,
    );
  }
  if (!("device_code" in body) || typeof body.device_code !== "string") {
    throw new Error(`device/code: unexpected response ${JSON.stringify(body)}`);
  }
  if (
    typeof body.user_code !== "string" ||
    typeof body.verification_uri !== "string"
  ) {
    throw new Error(
      `device/code: missing user_code or verification_uri ${JSON.stringify(body)}`,
    );
  }
  const interval = toFiniteNumber((body as DeviceCodeResponse).interval);
  const expiresIn = toFiniteNumber((body as DeviceCodeResponse).expires_in);
  if (interval === undefined || expiresIn === undefined) {
    throw new Error(
      `device/code: invalid interval or expires_in ${JSON.stringify(body)}`,
    );
  }
  return {
    ...body,
    interval,
    expires_in: expiresIn,
  } as DeviceCodeResponse;
}

function toFiniteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

/**
 * Polls `/api/auth/device/token` until success or terminal error.
 * First attempt is immediate; subsequent attempts wait `interval` seconds (increased on `slow_down`).
 */
export async function pollDeviceAccessToken(
  baseUrl: string,
  clientId: string,
  deviceCode: string,
  initialIntervalSec: number,
  options?: { maxWaitMs?: number; log?: (msg: string) => void },
): Promise<string> {
  const maxWait = options?.maxWaitMs ?? 30 * 60 * 1000;
  const log = options?.log ?? (() => {});
  const started = Date.now();
  let intervalMs = Math.max(1000, initialIntervalSec * 1000);

  for (let attempt = 0; Date.now() - started < maxWait; attempt++) {
    if (attempt > 0) {
      await sleep(intervalMs);
    }

    const res = await fetch(`${baseUrl}/api/auth/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: clientId,
      }),
    });

    if (Date.now() - started > maxWait) {
      throw new Error("Device authorization timed out waiting for approval.");
    }

    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (res.ok && typeof body.access_token === "string") {
      return body.access_token;
    }

    const err = body.error;
    if (err === "authorization_pending") {
      log("Waiting for device approval…");
      continue;
    }
    if (err === "slow_down") {
      intervalMs += 5000;
      log(`Rate limited (slow_down); polling every ${intervalMs / 1000}s`);
      continue;
    }
    if (err === "access_denied") {
      throw new Error("Device authorization was denied.");
    }
    if (err === "expired_token") {
      throw new Error("Device code expired; start login again.");
    }

    throw new Error(
      `device/token failed (${res.status}): ${JSON.stringify(body)}`,
    );
  }

  throw new Error("Device authorization timed out waiting for approval.");
}
