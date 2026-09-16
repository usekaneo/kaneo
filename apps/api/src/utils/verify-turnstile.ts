const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const DEFAULT_TIMEOUT_MS = 5000;

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

// Verifies a Cloudflare Turnstile token against the siteverify endpoint.
// Returns { ok: true } when the token is valid OR when no secret is configured
// (self-hosted instances opt out by leaving TURNSTILE_SECRET_KEY unset).
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: true };
  }
  if (!token) {
    return { ok: false, reason: "Captcha token missing." };
  }

  const raw = (process.env.TURNSTILE_TIMEOUT_MS ?? "").trim();
  const parsed = Number.parseInt(raw, 10);
  const timeoutMs =
    Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === raw
      ? parsed
      : DEFAULT_TIMEOUT_MS;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success === true) {
      return { ok: true };
    }
    const errorCodes = data["error-codes"]?.join(",") ?? "unknown";
    return {
      ok: false,
      reason: `Captcha verification failed (${errorCodes}).`,
    };
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      console.error("Turnstile verification timed out", error);
      return { ok: false, reason: "Captcha verification timed out." };
    }
    console.error("Turnstile verification request failed", error);
    return { ok: false, reason: "Captcha verification failed." };
  }
}
