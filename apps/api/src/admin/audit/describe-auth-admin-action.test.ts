import { describe, expect, it } from "vite-plus/test";
import type { AuditUserSnapshot } from "./audit-user-snapshot";
import { describeAuthAdminAction } from "./describe-auth-admin-action";

const target: AuditUserSnapshot = {
  id: "u1",
  name: "Tom",
  email: "tom@example.com",
  role: "user",
  banned: false,
  banReason: null,
  banExpires: null,
  emailVerified: true,
  image: null,
};

const update = (data: Record<string, unknown>, returned: object) =>
  describeAuthAdminAction({
    path: "/admin/update-user",
    body: { userId: "u1", data },
    target,
    returned: { ...target, ...returned },
  });

describe("describeAuthAdminAction", () => {
  it("splits a role change from the other changed fields", () => {
    expect(
      update(
        { name: "Tim", role: "admin", emailVerified: true },
        { name: "Tim", role: "admin" },
      ),
    ).toEqual([
      {
        action: "user.role_changed",
        targetType: "user",
        targetId: "u1",
        targetLabel: "tom@example.com",
        metadata: { from: "user", to: "admin" },
      },
      {
        action: "user.updated",
        targetType: "user",
        targetId: "u1",
        targetLabel: "tom@example.com",
        metadata: {
          fields: ["name"],
          changes: { name: { from: "Tom", to: "Tim" } },
        },
      },
    ]);
  });

  it("names changed fields without copying their values", () => {
    expect(update({ image: "data:..." }, { image: "data:..." })).toEqual([
      expect.objectContaining({
        action: "user.updated",
        metadata: { fields: ["image"], changes: {} },
      }),
    ]);
  });

  it("treats a ban through update-user as a deactivation", () => {
    expect(
      update(
        { banned: true, banReason: "Spam" },
        { banned: true, banReason: "Spam" },
      ).map((entry) => [entry.action, entry.metadata]),
    ).toEqual([["user.deactivated", { reason: "Spam", expiresAt: null }]]);
  });

  it("records nothing for unchanged updates, roles, or reactivations", () => {
    expect(update({ name: "Tom" }, {})).toEqual([]);
    expect(
      describeAuthAdminAction({
        path: "/admin/unban-user",
        body: { userId: "u1" },
        target,
        returned: { user: target },
      }),
    ).toEqual([]);
    expect(
      describeAuthAdminAction({
        path: "/admin/set-role",
        body: { userId: "u1", role: "user" },
        target,
        returned: { user: target },
      }),
    ).toEqual([]);
  });

  it("needs a known target, except when creating a user", () => {
    expect(
      describeAuthAdminAction({
        path: "/admin/ban-user",
        body: { userId: "u1" },
        target: undefined,
        returned: { user: target },
      }),
    ).toEqual([]);
    expect(
      describeAuthAdminAction({
        path: "/admin/create-user",
        body: { email: "new@example.com", password: "secret" },
        target: undefined,
        returned: { user: { id: "u2", email: "new@example.com", name: "N" } },
      }),
    ).toEqual([
      {
        action: "user.created",
        targetType: "user",
        targetId: "u2",
        targetLabel: "new@example.com",
        metadata: { name: "N", role: null },
      },
    ]);
  });

  it("only records a single-session revocation when the session was found", () => {
    const revoke = (sessionId?: string) =>
      describeAuthAdminAction({
        path: "/admin/revoke-user-session",
        body: { sessionToken: "secret-token" },
        target,
        sessionId,
        returned: { success: true },
      });
    expect(revoke()).toEqual([]);
    expect(revoke("s1")).toEqual([
      expect.objectContaining({
        action: "session.revoked",
        metadata: { sessionId: "s1" },
      }),
    ]);
  });
});
