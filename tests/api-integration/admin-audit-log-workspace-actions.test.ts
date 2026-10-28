import { beforeEach, describe, expect, it } from "vite-plus/test";
import { mockAuthenticatedSession } from "./helpers/auth";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

beforeEach(resetTestDatabase);

describe("audit of admin workspace membership changes", () => {
  it("records add, role change, ownership transfer, and removal", async () => {
    const ctx = await createRestrictedWorkspace();
    const { user: outsider } = await createWorkspaceMember({
      userName: "Outside Olive",
    });
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const request = projectAccessApi({ "user-agent": "audit-agent" });
    const base = `/admin/workspaces/${ctx.workspace.id}`;

    const steps = [
      () =>
        request(`${base}/members`, {
          method: "POST",
          body: { userId: outsider.id, role: "member" },
        }),
      () =>
        request(`${base}/members/${outsider.id}/role`, {
          method: "PUT",
          body: { role: "admin" },
        }),
      () =>
        request(`${base}/owner`, {
          method: "PUT",
          body: { userId: ctx.restricted.id },
        }),
      () => request(`${base}/members/${outsider.id}`, { method: "DELETE" }),
    ];
    for (const step of steps) {
      expect((await step()).status).toBe(200);
    }

    const rows = await readAuditLog();
    expect(rows.map((row) => [row.action, row.metadata])).toEqual([
      [
        "workspace.member_added",
        {
          member: {
            id: outsider.id,
            name: "Outside Olive",
            email: outsider.email,
          },
          role: "member",
        },
      ],
      [
        "workspace.member_removed",
        {
          member: {
            id: outsider.id,
            name: "Outside Olive",
            email: outsider.email,
          },
          role: "admin",
        },
      ],
      [
        "workspace.member_role_changed",
        {
          member: {
            id: outsider.id,
            name: "Outside Olive",
            email: outsider.email,
          },
          previousRole: "member",
          role: "admin",
        },
      ],
      [
        "workspace.owner_transferred",
        {
          member: {
            id: ctx.restricted.id,
            name: ctx.restricted.name,
            email: ctx.restricted.email,
          },
          previousRole: "member",
          previousOwnerIds: [ctx.owner.id],
        },
      ],
    ]);
    for (const row of rows) {
      expect(row).toMatchObject({
        actorUserId: admin.id,
        actorName: admin.name,
        actorEmail: admin.email,
        targetType: "workspace",
        targetId: ctx.workspace.id,
        targetLabel: ctx.workspace.name,
        userAgent: "audit-agent",
      });
    }
  });

  it("records nothing for rejected, forbidden, or unchanged requests", async () => {
    const ctx = await createRestrictedWorkspace();
    const base = `/admin/workspaces/${ctx.workspace.id}`;

    mockAuthenticatedSession(ctx.owner);
    expect(
      (
        await projectAccessApi()(`${base}/members/${ctx.restricted.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(403);

    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();
    expect(
      (await request(`${base}/members/${ctx.owner.id}`, { method: "DELETE" }))
        .status,
    ).toBe(409);
    expect(
      (
        await request(`${base}/members`, {
          method: "POST",
          body: { userId: ctx.restricted.id, role: "member" },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`${base}/members/${ctx.restricted.id}/role`, {
          method: "PUT",
          body: { role: "owner" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(`${base}/members/${ctx.restricted.id}/role`, {
          method: "PUT",
          body: { role: "member" },
        })
      ).status,
    ).toBe(200);

    expect(await readAuditLog()).toEqual([]);
  });
});
