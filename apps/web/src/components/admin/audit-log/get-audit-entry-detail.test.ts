import { describe, expect, it } from "vite-plus/test";
import { getAuditEntryDetail } from "./get-audit-entry-detail";

const t = (key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key;

describe("getAuditEntryDetail", () => {
  it("names the role a user was created with", () => {
    expect(
      getAuditEntryDetail(
        { action: "user.created", metadata: { name: "Nora", role: "admin" } },
        t,
      ),
    ).toBe(
      'settings:adminAuditLog.details.createdWithRole {"role":"settings:adminUsers.roles.admin"}',
    );
  });

  it("translates instance role changes", () => {
    expect(
      getAuditEntryDetail(
        {
          action: "user.role_changed",
          metadata: { from: "user", to: "admin,custom" },
        },
        t,
      ),
    ).toBe(
      'settings:adminAuditLog.details.change {"from":"settings:adminUsers.roles.user","to":"settings:adminUsers.roles.admin, custom"}',
    );
  });

  it("lists changed fields by their labels", () => {
    expect(
      getAuditEntryDetail(
        { action: "user.updated", metadata: { fields: ["name", "locale"] } },
        t,
      ),
    ).toBe(
      'settings:adminAuditLog.details.fields {"fields":"settings:adminAuditLog.fields.name, locale"}',
    );
  });

  it("names the workspace member and their roles", () => {
    expect(
      getAuditEntryDetail(
        {
          action: "workspace.member_role_changed",
          metadata: {
            member: { id: "u1", name: "", email: "ada@example.com" },
            previousRole: "member",
            role: "reviewer",
          },
        },
        t,
      ),
    ).toBe(
      'settings:adminAuditLog.details.memberChange {"member":"ada@example.com","from":"team:roles.member","to":"reviewer"}',
    );
  });

  it("returns nothing when there is nothing to add", () => {
    expect(
      getAuditEntryDetail({ action: "user.deactivated", metadata: {} }, t),
    ).toBeNull();
    expect(
      getAuditEntryDetail({ action: "session.revoked_all", metadata: null }, t),
    ).toBeNull();
    expect(
      getAuditEntryDetail({ action: "role.created", metadata: { a: 1 } }, t),
    ).toBeNull();
  });

  it("counts revoked sessions and names revoked API keys", () => {
    expect(
      getAuditEntryDetail(
        { action: "session.revoked_all", metadata: { count: 3 } },
        t,
      ),
    ).toBe('settings:adminAuditLog.details.sessionCount {"count":3}');
    expect(
      getAuditEntryDetail(
        {
          action: "api_key.revoked",
          metadata: { keyId: "k1", keyName: "CI deploys" },
        },
        t,
      ),
    ).toBe("CI deploys");
  });

  it("summarises what a deleted workspace contained", () => {
    expect(
      getAuditEntryDetail(
        {
          action: "workspace.deleted",
          metadata: { slug: "acme", memberCount: 3, projectCount: 2 },
        },
        t,
      ),
    ).toBe(
      'settings:adminAuditLog.details.workspaceContents {"members":3,"projects":2}',
    );
    expect(
      getAuditEntryDetail(
        { action: "workspace.archived", metadata: { slug: "acme" } },
        t,
      ),
    ).toBeNull();
  });
});
