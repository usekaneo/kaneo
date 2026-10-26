import type { AuditUserSnapshot } from "./audit-user-snapshot";

export type AuthAdminAuditEntry = {
  action: string;
  targetType: "user";
  targetId: string;
  targetLabel: string;
  metadata?: Record<string, unknown>;
};

type ReturnedUser = Partial<AuditUserSnapshot> & {
  banReason?: string | null;
  banExpires?: Date | string | null;
};

const BAN_FIELDS = new Set(["banned", "banReason", "banExpires"]);
// Values shown in the log; any other changed field is listed by name only.
const SHOWN_FIELDS = new Set(["name", "email", "emailVerified"]);

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function unwrapUser(returned: unknown): ReturnedUser | undefined {
  if (!returned || typeof returned !== "object") return undefined;
  const value = returned as { user?: unknown };
  return (
    value.user && typeof value.user === "object" ? value.user : returned
  ) as ReturnedUser;
}

function deactivation(user: ReturnedUser | undefined) {
  return {
    reason: user?.banReason ?? null,
    expiresAt: user?.banExpires ?? null,
  };
}

function describeUpdate(
  target: AuditUserSnapshot,
  data: Record<string, unknown>,
  updated: ReturnedUser,
) {
  const read = (source: object, key: string) =>
    (source as Record<string, unknown>)[key];
  const changed = Object.keys(data).filter(
    (key) =>
      key !== "updatedAt" && !same(read(target, key), read(updated, key)),
  );
  const entries: Omit<AuthAdminAuditEntry, "targetType" | "targetId">[] = [];
  const label = updated.email ?? target.email;

  if (changed.includes("role")) {
    entries.push({
      action: "user.role_changed",
      targetLabel: label,
      metadata: { from: target.role, to: updated.role ?? null },
    });
  }
  if (changed.includes("banned")) {
    entries.push({
      action: updated.banned ? "user.deactivated" : "user.reactivated",
      targetLabel: label,
      metadata: updated.banned ? deactivation(updated) : undefined,
    });
  }
  const fields = changed.filter(
    (key) =>
      key !== "role" && !(changed.includes("banned") && BAN_FIELDS.has(key)),
  );
  if (fields.length > 0) {
    const changes = Object.fromEntries(
      fields
        .filter((key) => SHOWN_FIELDS.has(key))
        .map((key) => [
          key,
          { from: read(target, key) ?? null, to: read(updated, key) ?? null },
        ]),
    );
    entries.push({
      action: "user.updated",
      targetLabel: label,
      metadata: { fields, changes },
    });
  }
  return entries;
}

export type AuthAdminCall = {
  path: string;
  body: Record<string, unknown> | undefined;
  /** The affected user as it was before the call. */
  target: AuditUserSnapshot | undefined;
  /** For single-session revocation: the session's id, never its token. */
  sessionId?: string;
  returned: unknown;
};

/** Turn a successful better-auth admin endpoint call into audit entries. */
export function describeAuthAdminAction({
  path,
  body,
  target,
  sessionId,
  returned,
}: AuthAdminCall): AuthAdminAuditEntry[] {
  const user = unwrapUser(returned);

  if (path === "/admin/create-user") {
    if (!user?.id || !user.email) return [];
    return [
      {
        action: "user.created",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
        metadata: { name: user.name ?? null, role: user.role ?? null },
      },
    ];
  }

  if (!target) return [];
  const about = (
    action: string,
    metadata?: Record<string, unknown>,
  ): AuthAdminAuditEntry => ({
    action,
    targetType: "user",
    targetId: target.id,
    targetLabel: target.email,
    metadata,
  });

  switch (path) {
    case "/admin/update-user": {
      const data = body?.data;
      if (!user || !data || typeof data !== "object") return [];
      return describeUpdate(target, data as Record<string, unknown>, user).map(
        (entry) => ({ ...entry, targetType: "user", targetId: target.id }),
      );
    }
    case "/admin/set-role":
      return same(target.role, user?.role)
        ? []
        : [about("user.role_changed", { from: target.role, to: user?.role })];
    case "/admin/ban-user":
      return [about("user.deactivated", deactivation(user))];
    case "/admin/unban-user":
      return target.banned ? [about("user.reactivated")] : [];
    case "/admin/remove-user":
      return [about("user.deleted", { name: target.name })];
    case "/admin/set-user-password":
      return [about("user.password_set")];
    case "/admin/impersonate-user":
      return [about("user.impersonated")];
    case "/admin/revoke-user-session":
      return sessionId ? [about("session.revoked", { sessionId })] : [];
    case "/admin/revoke-user-sessions":
      return [about("session.revoked_all")];
    default:
      return [];
  }
}
