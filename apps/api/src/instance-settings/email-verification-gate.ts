import { eq } from "drizzle-orm";
import db from "../database";
import { userTable } from "../database/schema";
import { hasRegisteredUsers } from "../utils/instance-bootstrap";
import { getInstanceSettings } from "./get-instance-settings";
import { sendSignUpVerificationEmail } from "./send-sign-up-verification-email";

type AuthRequest = { path: string; body?: { email?: unknown } | null };

/**
 * Whether a new password sign-up must confirm its email before signing in.
 * The first account sets the instance up, so it is never held back.
 */
export async function signUpNeedsVerification(path: string | undefined) {
  return (
    path === "/sign-up/email" &&
    (await getInstanceSettings()).requireEmailVerification &&
    (await hasRegisteredUsers())
  );
}

async function signInNeedsVerification(email: unknown) {
  if (typeof email !== "string") return false;
  if (!(await getInstanceSettings()).requireEmailVerification) return false;
  const [user] = await db
    .select({
      required: userTable.emailVerificationRequired,
      verified: userTable.emailVerified,
    })
    .from(userTable)
    .where(eq(userTable.email, email.trim().toLowerCase()))
    .limit(1);
  return Boolean(user?.required && !user.verified);
}

/**
 * A better-auth `before` hook result that turns on its email verification for
 * this request only: sign-up skips the session and emails a link, and password
 * sign-in of an unconfirmed sign-up is refused with a fresh link. better-auth
 * reads these options per request, and the shared options stay untouched.
 */
export async function emailVerificationContext(ctx: AuthRequest) {
  const required =
    ctx.path === "/sign-up/email"
      ? await signUpNeedsVerification(ctx.path)
      : ctx.path === "/sign-in/email" &&
        (await signInNeedsVerification(ctx.body?.email));
  if (!required) return undefined;
  return {
    context: {
      context: {
        options: {
          emailAndPassword: { requireEmailVerification: true },
          emailVerification: {
            sendOnSignUp: true,
            sendOnSignIn: true,
            sendVerificationEmail: sendSignUpVerificationEmail,
          },
        },
      },
    },
  };
}
