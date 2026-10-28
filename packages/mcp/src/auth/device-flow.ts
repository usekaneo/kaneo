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

export class DeviceCodeRequestError extends Error {
  readonly status: number;
  readonly error: string | undefined;

  constructor(status: number, body: Record<string, unknown>) {
    super(`device/code failed (${status}): ${JSON.stringify(body)}`);
    this.name = "DeviceCodeRequestError";
    this.status = status;
    this.error = typeof body.error === "string" ? body.error : undefined;
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === "AbortError"
    : err instanceof Error && err.name === "AbortError";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestDeviceCode(
  baseUrl: string,
  clientId: string,
): Promise<DeviceCodeResponse> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${baseUrl}/api/auth/device/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error("device/code request timed out after 10s.");
    }
    throw err;
  }
  const parsedBody: unknown = await res.json().catch(() => ({}));
  if (!isObjectRecord(parsedBody)) {
    throw new Error(
      `device/code: unexpected response ${JSON.stringify(parsedBody)}`,
    );
  }
  const body = parsedBody;
  if (!res.ok) {
    throw new DeviceCodeRequestError(res.status, body);
  }
  if (typeof body.device_code !== "string") {
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
  const interval = toFiniteNumber(body.interval);
  const expiresIn = toFiniteNumber(body.expires_in);
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

export type DeviceTokenPoll =
  | { status: "approved"; accessToken: string }
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "denied" }
  | { status: "expired" };

export async function pollDeviceTokenOnce(
  baseUrl: string,
  clientId: string,
  deviceCode: string,
): Promise<DeviceTokenPoll> {
  const res = await fetchWithTimeout(`${baseUrl}/api/auth/device/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: clientId,
    }),
  });

  const parsedBody: unknown = await res.json().catch(() => ({}));
  if (!isObjectRecord(parsedBody)) {
    throw new Error(
      `device/token failed (${res.status}): ${JSON.stringify(parsedBody)}`,
    );
  }
  const body = parsedBody;

  if (res.ok && typeof body.access_token === "string") {
    return { status: "approved", accessToken: body.access_token };
  }

  const err = typeof body.error === "string" ? body.error : undefined;
  if (err === "authorization_pending") {
    return { status: "pending" };
  }
  if (err === "slow_down") {
    return { status: "slow_down" };
  }
  if (err === "access_denied") {
    return { status: "denied" };
  }
  if (err === "expired_token") {
    return { status: "expired" };
  }

  throw new Error(
    `device/token failed (${res.status}): ${JSON.stringify(body)}`,
  );
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
      if (Date.now() - started >= maxWait) {
        break;
      }
    }

    let poll: DeviceTokenPoll;
    try {
      poll = await pollDeviceTokenOnce(baseUrl, clientId, deviceCode);
    } catch (err) {
      if (isAbortError(err)) {
        log("Device token poll request timed out; retrying.");
        continue;
      }
      throw err;
    }

    if (Date.now() - started >= maxWait) {
      throw new Error("Device authorization timed out waiting for approval.");
    }

    if (poll.status === "approved") {
      return poll.accessToken;
    }
    if (poll.status === "pending") {
      log("Waiting for device approval…");
      continue;
    }
    if (poll.status === "slow_down") {
      intervalMs += 5000;
      log(`Rate limited (slow_down); polling every ${intervalMs / 1000}s`);
      continue;
    }
    if (poll.status === "denied") {
      throw new Error("Device authorization was denied.");
    }
    throw new Error("Device code expired; start login again.");
  }

  throw new Error("Device authorization timed out waiting for approval.");
}
