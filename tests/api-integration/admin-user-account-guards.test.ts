import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import deleteUser from "../../apps/api/src/admin/controllers/delete-user";
import * as adminAudit from "../../apps/api/src/admin/audit/record-admin-action";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import * as accountCleanup from "../../apps/api/src/user/controllers/delete-account-data";
import { deleteNativeWorkspace } from "../../apps/api/src/workspace/lifecycle/delete-native-workspace";
import { signInWithRole } from "./helpers/admin/instance-roles";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeAll(() => {
  vi.stubEnv("DATABASE_POOL_MAX", "2");
});
afterAll(() => {
  vi.unstubAllEnvs();
});
beforeEach(resetTestDatabase);

describe("admin account guards", () => {
  it("deletes an account while its administrator deletes their workspace", async () => {
    expect(getDatabasePool().options.max).toBe(2);
    const target = await createWorkspaceMember({ role: "owner" });
    const actor = await createWorkspaceMember({ role: "owner" });
    await db
      .update(schema.userTable)
      .set({ role: "user,admin" })
      .where(inArray(schema.userTable.id, [target.user.id, actor.user.id]));

    const workspaceDeleted = Promise.withResolvers<void>();
    const cleanupStarted = Promise.withResolvers<void>();
    const record = adminAudit.recordAdminAction;
    vi.spyOn(adminAudit, "recordAdminAction").mockImplementation(
      async (input, tx) => {
        if (input.action === "workspace.deleted") {
          // Hold the workspace lock until account cleanup has started.
          workspaceDeleted.resolve();
          await cleanupStarted.promise;
        }
        return record(input, tx);
      },
    );
    const cleanup = accountCleanup.default;
    vi.spyOn(accountCleanup, "default").mockImplementation((...args) => {
      cleanupStarted.resolve();
      return cleanup(...args);
    });

    const workspaceDeletion = deleteNativeWorkspace(
      target.workspace.id,
      target.user.id,
      { ipAddress: null, userAgent: null },
    );
    await workspaceDeleted.promise;
    // Both operations have passed authorization. The workspace audit needs a
    // foreign-key lock on its actor, the account being deleted concurrently.
    const results = await Promise.allSettled([
      workspaceDeletion,
      deleteUser(target.user.id, actor.user.id, {
        actorUserId: actor.user.id,
        ipAddress: null,
        userAgent: null,
      }),
    ]);

    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
    expect(
      await db.query.userTable.findFirst({
        where: eq(schema.userTable.id, target.user.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.workspaceTable.findFirst({
        where: eq(schema.workspaceTable.id, target.workspace.id),
      }),
    ).toBeUndefined();
    const audit = await readAuditLog();
    expect(audit.map((entry) => entry.action).sort()).toEqual([
      "user.deleted",
      "workspace.deleted",
    ]);
    expect(
      audit.find((entry) => entry.action === "workspace.deleted"),
    ).toMatchObject({ actorUserId: null });
  });

  it("keeps one administrator and their workspace during concurrent deletions", async () => {
    expect(getDatabasePool().options.max).toBe(2);
    const first = await createWorkspaceMember({ role: "owner" });
    const second = await createWorkspaceMember({ role: "owner" });
    const ids = [first.user.id, second.user.id];
    await db
      .update(schema.userTable)
      .set({ role: "user,admin" })
      .where(inArray(schema.userTable.id, ids));

    // Both requests have already passed authorization before either deletion.
    const results = await Promise.allSettled(
      [first, second].map((target, index) => {
        const actorId = ids[1 - index];
        return deleteUser(target.user.id, actorId, {
          actorUserId: actorId,
          ipAddress: null,
          userAgent: null,
        });
      }),
    );

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({
      reason: { status: 400, code: "CANNOT_REMOVE_LAST_ADMIN" },
    });
    const remaining = await db.select().from(schema.userTable);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].role).toBe("user,admin");
    const kept = [first, second].find(
      (target) => target.user.id === remaining[0].id,
    );
    expect(kept).toBeDefined();
    const workspaces = await db.select().from(schema.workspaceTable);
    expect(workspaces.map((workspace) => workspace.id)).toEqual([
      kept?.workspace.id,
    ]);
    expect((await readAuditLog()).map((entry) => entry.action)).toEqual([
      "user.deleted",
    ]);
  });

  it("rejects self-reactivation without changing the account or audit log", async () => {
    const { app } = createApp();
    const admin = await signInWithRole(app, "admin");

    const response = await admin.api(`/users/${admin.userId}/reactivate`, {
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(await readErrorBody(response)).toMatchObject({
      code: "YOU_CANNOT_UNBAN_YOURSELF",
    });
    const [user] = await db
      .select({ banned: schema.userTable.banned })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, admin.userId));
    expect(user.banned).toBe(false);
    expect(await readAuditLog()).toEqual([]);
  });
});
