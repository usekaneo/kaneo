import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const repair = readFileSync(
  new URL(
    "../../apps/api/drizzle/0047_repair_legacy_auth_ownership.sql",
    import.meta.url,
  ),
  "utf8",
);
beforeEach(async () => {
  await resetTestDatabase();
});

describe("legacy ownership and archival migration", () => {
  it("repairs the old comment-only schema, retains valid keys and invalidates orphaned credentials", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await db.transaction(async (tx) => {
      // Model an already-applied old0015 journal: archived_at absent, ownership
      // constraints never installed. All DDL is isolated to this transaction.
      await tx.execute(sql`ALTER TABLE project DROP COLUMN archived_at`);
      await tx.execute(
        sql`ALTER TABLE apikey DROP CONSTRAINT apikey_reference_id_user_id_fk`,
      );
      await tx.execute(
        sql`ALTER TABLE apikey ALTER COLUMN reference_id DROP NOT NULL`,
      );
      await tx.execute(sql`
        INSERT INTO apikey (id, key, user_id, reference_id, created_at, updated_at)
        VALUES ('legacy', 'legacy-hash', ${user.id}, null, now(), now()),
               ('modern', 'modern-hash', null, ${user.id}, now(), now()),
               ('orphan', 'orphan-hash', null, 'deleted-user', now(), now()),
               ('missing', 'missing-hash', null, null, now(), now()),
               ('contradictory', 'invalid-reference-hash', ${user.id}, 'deleted-user', now(), now())
      `);
      await tx.execute(sql.raw(repair));
      await tx.execute(sql.raw(repair));
      const keys = await tx
        .select({
          id: schema.apikeyTable.id,
          key: schema.apikeyTable.key,
          referenceId: schema.apikeyTable.referenceId,
        })
        .from(schema.apikeyTable);
      expect(keys).toEqual(
        expect.arrayContaining([
          { id: "legacy", key: "legacy-hash", referenceId: user.id },
          { id: "modern", key: "modern-hash", referenceId: user.id },
        ]),
      );
      expect(keys).toHaveLength(2);
      const [archived] = await tx
        .update(schema.projectTable)
        .set({ archivedAt: new Date("2026-09-19") })
        .where(eq(schema.projectTable.id, project.id))
        .returning();
      expect(archived.archivedAt).toEqual(new Date("2026-09-19"));
      await tx.delete(schema.userTable).where(eq(schema.userTable.id, user.id));
      expect(await tx.select().from(schema.apikeyTable)).toHaveLength(0);
    });
  });

  it.each([null, "nonexistent-user"])(
    "rejects invalid ownership after all fresh migrations: %s",
    async (owner) => {
      await expect(
        db.execute(
          sql`INSERT INTO apikey (id, key, reference_id, created_at, updated_at) VALUES ('bad', 'bad-hash', ${owner}, now(), now())`,
        ),
      ).rejects.toThrow();
    },
  );

  it("preserves an already archived project on repeat application", async () => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const date = new Date("2026-01-01T12:00:00.000Z");
    await db
      .update(schema.projectTable)
      .set({ archivedAt: date })
      .where(eq(schema.projectTable.id, project.id));
    await db.execute(sql.raw(repair));
    expect(
      await db.query.projectTable.findFirst({
        where: eq(schema.projectTable.id, project.id),
      }),
    ).toHaveProperty("archivedAt", date);
  });
});
