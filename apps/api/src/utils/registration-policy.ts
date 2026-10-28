import { APIError } from "better-auth/api";
import { getInstanceSettings } from "../instance-settings/get-instance-settings";
import {
  checkRegistrationAllowed,
  userExistsByEmail,
} from "./check-registration-allowed";
import { hasRegisteredUsers } from "./instance-bootstrap";
import { isCloud } from "./is-cloud";
import { isDisposableEmail } from "./is-disposable-email";

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

function disposableEmailError() {
  return new APIError("BAD_REQUEST", {
    code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
    message:
      "Use a permanent email address. Disposable addresses cannot create accounts.",
  });
}

export async function assertEmailCodeRecipientAllowed(
  email: unknown,
): Promise<void> {
  if (!isCloud() || typeof email !== "string" || !isDisposableEmail(email))
    return;
  if (!(await hasRegisteredUsers()) || (await userExistsByEmail(email))) return;
  throw disposableEmailError();
}

/** Guests are self-registered accounts, so any registration limit hides them. */
export async function isGuestAccessAvailable(): Promise<boolean> {
  if (
    process.env.DISABLE_GUEST_ACCESS === "true" ||
    process.env.DISABLE_LOGIN_FORM === "true"
  )
    return false;
  const settings = await getInstanceSettings();
  return settings.registrationEnabled && settings.passwordRegistrationEnabled;
}

export async function assertGuestRegistrationAllowed(): Promise<void> {
  if (!(await isGuestAccessAvailable()) || !(await hasRegisteredUsers())) {
    throw new APIError("FORBIDDEN", {
      code: "GUEST_ACCESS_DISABLED",
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
  if (isCloud() && isDisposableEmail(user.email)) throw disposableEmailError();
  if (
    !(await getInstanceSettings()).passwordRegistrationEnabled &&
    !isOAuthCallbackPath(context?.path)
  ) {
    throw new APIError("FORBIDDEN", {
      code: "LOCAL_REGISTRATION_DISABLED",
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
    throw new APIError("FORBIDDEN", {
      code: "REGISTRATION_NOT_ALLOWED",
      message: result.reason,
    });
}
