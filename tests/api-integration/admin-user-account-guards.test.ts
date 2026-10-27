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
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
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
