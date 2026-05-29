const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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
    console.error("Turnstile verification request failed", error);
    return { ok: false, reason: "Captcha verification failed." };
  }
}
