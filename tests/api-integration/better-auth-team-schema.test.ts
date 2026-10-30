import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);

describe("Better Auth team schema upgrade", () => {
  it("preserves existing memberships and backfills team counts", async () => {
    const { user, workspace } = await createWorkspaceMember();
    await db.insert(schema.teamTable).values([
      {
        id: "legacy-team",
        name: "Legacy",
        workspaceId: workspace.id,
        createdAt: new Date(),
      },
      {
        id: "empty-team",
        name: "Empty",
        workspaceId: workspace.id,
        createdAt: new Date(),
      },
    ]);
    await db
      .insert(schema.teamMemberTable)
      .values({ id: "legacy-member", teamId: "legacy-team", userId: user.id });

    await db.transaction(async (tx) => {
      await tx.execute(sql`ALTER TABLE "team" DROP COLUMN "member_count"`);
      await tx.execute(
        sql`ALTER TABLE "team_member" DROP COLUMN "membership_key"`,
      );
      const migration = readFileSync(
        new URL(
          "../../apps/api/drizzle/0067_better_auth_team_membership.sql",
          import.meta.url,
        ),
        "utf8",
      );
      for (const statement of migration.split("--> statement-breakpoint")) {
        await tx.execute(sql.raw(statement));
      }
      expect(
        await tx
          .select({
            id: schema.teamTable.id,
            count: schema.teamTable.memberCount,
          })
          .from(schema.teamTable)
          .orderBy(schema.teamTable.id),
      ).toEqual([
        { id: "empty-team", count: 0 },
        { id: "legacy-team", count: 1 },
      ]);
      expect(await tx.select().from(schema.teamMemberTable)).toMatchObject([
        {
          id: "legacy-member",
          teamId: "legacy-team",
          userId: user.id,
          membershipKey: null,
        },
      ]);
    });
  });

  it("creates a workspace and updates the default team's membership count", async () => {
    const { app } = createApp();
    const owner = await signUpWithSession(app, {
      name: "Dependency Owner",
      email: "dependency@example.com",
    });
    const request = (path: string, body: object) =>
      app.request(`/api/auth/organization/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: "http://localhost:5173",
          cookie: owner.cookies,
        },
        body: JSON.stringify(body),
      });
    const created = await request("create", {
      name: "Dependencies",
      slug: "dependencies",
    });
    expect(created.status).toBe(200);
    const workspace = (await created.json()) as { id: string };
    const [team] = await db
      .select()
      .from(schema.teamTable)
      .where(eq(schema.teamTable.workspaceId, workspace.id));
    expect(team.memberCount).toBe(1);
    const [member] = await db.select().from(schema.teamMemberTable);
    expect(member.membershipKey).toEqual(expect.any(String));

    const membership = {
      teamId: team.id,
      userId: owner.userId,
      organizationId: workspace.id,
    };
    expect((await request("remove-team-member", membership)).status).toBe(200);
    expect(
      (
        await db
          .select()
          .from(schema.teamTable)
          .where(eq(schema.teamTable.id, team.id))
      )[0]?.memberCount,
    ).toBe(0);
    expect((await request("add-team-member", membership)).status).toBe(200);
    expect(
      (
        await db
          .select()
          .from(schema.teamTable)
          .where(eq(schema.teamTable.id, team.id))
      )[0]?.memberCount,
    ).toBe(1);
  });
});
