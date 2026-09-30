import { sendOutboundRequest } from "./outbound-request";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export const authCaptchaPaths = new Set([
  "/sign-up/email",
  "/sign-in/social",
  "/sign-in/oauth2",
  "/sign-in/anonymous",
  "/sign-in/magic-link",
  "/request-password-reset",
  "/email-otp/send-verification-otp",
]);

// One token is redeemed at initiation, never again at the OAuth callback or
// OTP redemption. Better Auth verifies the corresponding state/code there.
export async function verifyTurnstile(
  token: unknown,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };
  const failure = {
    ok: false,
    reason: "Captcha verification failed.",
  } as const;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048)
    return failure;

  try {
    const hostname = new URL(process.env.KANEO_CLIENT_URL || "").hostname;
    if (
      process.env.KANEO_CLOUD === "true" &&
      process.env.NODE_ENV === "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
    )
      return failure;
    const data = await sendOutboundRequest(
      TURNSTILE_VERIFY_URL,
      {
        body: new URLSearchParams({ secret, response: token }),
      },
      { readJson: true },
    );
    if (
      data &&
      typeof data === "object" &&
      "success" in data &&
      data.success === true &&
      "action" in data &&
      data.action === "auth" &&
      "hostname" in data &&
      data.hostname === hostname
    )
      return { ok: true };
  } catch {
    // Fail closed without retaining token, secret or an upstream error body.
  }
  return failure;
}
