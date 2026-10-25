import { APIError, getSessionFromCtx } from "better-auth/api";
import { apiKeyDenialHeaders } from "./rate-limit-headers";
import { type PermissionMap, satisfies } from "./role-permissions";
import { verifyApiKey } from "./verify-api-key";

type AuthContext = Parameters<typeof getSessionFromCtx>[0];

// These organization operations are used by the published CLI/mobile clients.
// Everything else (including new provider endpoints) requires a real session.
const organizationScopes: Record<string, PermissionMap> = {
  list: { workspace: ["read"] },
  "get-full-organization": { workspace: ["read"] },
  "list-members": { workspace: ["read"] },
  "get-active-member": { workspace: ["read"] },
  "get-active-member-role": {},
  "has-permission": {},
  "list-roles": { ac: ["read"] },
  "get-role": { ac: ["read"] },
  "create-role": { ac: ["create"] },
  "update-role": { ac: ["update"] },
  "delete-role": { ac: ["delete"] },
  "list-teams": { workspace: ["read"] },
  "list-user-teams": { workspace: ["read"] },
  "list-team-members": { workspace: ["read"] },
  "create-team": { team: ["create"] },
  "update-team": { team: ["update"] },
  "remove-team": { team: ["delete"] },
  "add-team-member": { team: ["update"] },
  "remove-team-member": { team: ["update"] },
  "set-active-team": { workspace: ["read"] },
  "list-invitations": { invitation: ["create"] },
  "invite-member": { invitation: ["create"] },
  "cancel-invitation": { invitation: ["cancel"] },
  "add-member": { member: ["create"] },
  "remove-member": { member: ["delete"] },
  "update-member-role": { member: ["update"] },
  update: { organization: ["update"] },
  delete: { organization: ["delete"] },
  "check-slug": { workspace: ["read"] },
  "set-active": { workspace: ["read"] },
  // Self-membership changes have no provider ACL action. Require explicit
  // workspace management authority from scoped keys; legacy keys retain usage.
  create: { workspace: ["manage_settings"] },
  leave: { workspace: ["manage_settings"] },
  "accept-invitation": { workspace: ["manage_settings"] },
  "reject-invitation": { workspace: ["manage_settings"] },
  "get-invitation": { workspace: ["manage_settings"] },
  "list-user-invitations": { workspace: ["manage_settings"] },
};

type VerifiedKey = Extract<
  Awaited<ReturnType<typeof verifyApiKey>>,
  { status: "valid" }
>["key"];
type Key = Pick<VerifiedKey, "id" | "userId" | "permissions">;

// The provider shares context between its hooks. Retain only verified scope,
// never the raw credential, for response filtering after its virtual session.
type BoundaryContext = AuthContext["context"] & { kaneoApiKey?: Key };

export function nativeAuthApiKey(ctx: AuthContext) {
  return (ctx.context as BoundaryContext).kaneoApiKey;
}

export async function assertNativeAuthApiKeyAllowed(ctx: AuthContext) {
  const credential = ctx.headers?.get("x-api-key");
  if (!credential) return;
  const operation = ctx.path?.startsWith("/organization/")
    ? ctx.path.slice("/organization/".length)
    : undefined;
  const required =
    operation === "get-active-member-role" && ctx.query?.userId
      ? { workspace: ["read"] }
      : operation
        ? organizationScopes[operation]
        : undefined;
  if (ctx.path !== "/get-session" && !required) {
    throw new APIError("FORBIDDEN", {
      code: "SESSION_REQUIRED",
      message: "A user session is required",
    });
  }
  const verified = await verifyApiKey(credential, { consume: false });
  if (verified && verified.status !== "valid") {
    throw new APIError(
      "TOO_MANY_REQUESTS",
      {
        code: "RATE_LIMITED",
        message:
          verified.status === "rate_limited"
            ? "Rate limit exceeded"
            : "API key usage limit exceeded",
      },
      apiKeyDenialHeaders(verified, new Date()),
    );
  }
  if (verified?.status !== "valid") {
    throw new APIError("UNAUTHORIZED", {
      code: "INVALID_API_KEY",
      message: "Invalid API key",
    });
  }
  const scope = verified.key.permissions;
  if (scope && required && !satisfies(scope, required)) {
    throw new APIError("FORBIDDEN", {
      code: "API_KEY_SCOPE",
      message: "Insufficient API key scope",
    });
  }
  if (
    scope &&
    operation === "has-permission" &&
    !satisfies(scope, ctx.body?.permissions ?? ctx.body?.permission ?? {})
  ) {
    throw new APIError("FORBIDDEN", {
      code: "API_KEY_SCOPE",
      message: "Insufficient API key scope",
    });
  }
  (ctx.context as BoundaryContext).kaneoApiKey = {
    id: verified.key.id,
    userId: verified.key.userId,
    permissions: verified.key.permissions,
  };
}
