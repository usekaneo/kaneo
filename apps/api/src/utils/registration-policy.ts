import { APIError } from "better-auth/api";
import { checkRegistrationAllowed } from "./check-registration-allowed";
import { hasRegisteredUsers } from "./instance-bootstrap";

export function normalizeInvitationId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return /^[a-z0-9_-]{1,128}$/i.test(normalized) ? normalized : undefined;
}

export function isOAuthCallbackPath(path: unknown): boolean {
  return (
    typeof path === "string" &&
    (path.startsWith("/callback/") || path.startsWith("/oauth2/callback/"))
  );
}

export async function assertGuestRegistrationAllowed(): Promise<void> {
  if (
    process.env.DISABLE_GUEST_ACCESS === "true" ||
    process.env.DISABLE_REGISTRATION === "true" ||
    process.env.DISABLE_PASSWORD_REGISTRATION === "true" ||
    process.env.DISABLE_LOGIN_FORM === "true" ||
    !(await hasRegisteredUsers())
  ) {
    throw new APIError("FORBIDDEN", {
      message: "Guest access is unavailable on this instance.",
    });
  }
}

export async function assertUserRegistrationAllowed(
  user: {
    email: string;
    emailVerified?: boolean;
    isAnonymous?: boolean | null;
  },
  context?: { path?: string; invitationId?: unknown },
): Promise<void> {
  if (user.isAnonymous) {
    await assertGuestRegistrationAllowed();
    return;
  }
  if (!(await hasRegisteredUsers())) return;
  if (
    process.env.DISABLE_PASSWORD_REGISTRATION === "true" &&
    !isOAuthCallbackPath(context?.path)
  ) {
    throw new APIError("FORBIDDEN", {
      message:
        "Local account registration is disabled. Please use a configured social or OIDC sign-in method.",
    });
  }
  const verifiedEmailFlow =
    isOAuthCallbackPath(context?.path) ||
    context?.path === "/sign-in/email-otp" ||
    context?.path === "/magic-link/verify";
  const result = await checkRegistrationAllowed(
    user.email,
    normalizeInvitationId(context?.invitationId),
    {
      allowInvitationByEmail: verifiedEmailFlow,
      emailVerified: user.emailVerified === true,
    },
  );
  if (!result.allowed)
    throw new APIError("FORBIDDEN", { message: result.reason });
}
