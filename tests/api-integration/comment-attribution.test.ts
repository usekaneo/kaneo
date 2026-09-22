import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);
describe("external comment attribution", () => {
  it.each(["planka", "trello", "jira"])(
    "blocks ordinary member impersonation through %s but allows their own comments",
    async (externalSource) => {
      const member = await createWorkspaceMember();
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title: "Task",
          status: "to-do",
          number: 1,
        })
        .returning();
      mockAuthenticatedSession(member.user);
      const { app } = createApp();
      const send = (body: object) =>
        app.request(`/api/comment/${task.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      expect(
        (
          await send({
            content: "Fake",
            externalUserName: "Executive",
            externalSource,
          })
        ).status,
      ).toBe(403);
      expect(await db.select().from(schema.activityTable)).toHaveLength(0);
      expect((await send({ content: "My comment" })).status).toBe(200);
      const [row] = await db.select().from(schema.activityTable);
      expect(row.userId).toBe(member.user.id);
      expect(row.externalUserName).toBeNull();
      expect(row.externalSource).toBeNull();
    },
  );

  it.each([false, true])(
    "requires explicit import permission on an admin's API key (granted=%s)",
    async (granted) => {
      const member = await createWorkspaceMember({ role: "admin" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title: "Task",
          status: "to-do",
          number: 1,
        })
        .returning();
      mockAnonymousSession();
      const key = `test_${randomUUID()}`;
      await db.insert(schema.apikeyTable).values({
        referenceId: member.user.id,
        userId: member.user.id,
        key: createHash("sha256").update(key).digest("base64url"),
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: JSON.stringify({
          task: ["update"],
          ...(granted ? { workspace: ["manage_settings"] } : {}),
        }),
      });
      const { app } = createApp();
      const response = await app.request(`/api/comment/${task.id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          content: "Imported",
          externalSource: "planka",
          externalUserName: "Historical Author",
        }),
      });
      expect(response.status).toBe(granted ? 200 : 403);
      const rows = await db.select().from(schema.activityTable);
      expect(rows).toHaveLength(granted ? 1 : 0);
      if (granted)
        expect(rows[0]).toMatchObject({
          userId: member.user.id,
          externalUserName: "Historical Author",
          externalSource: "planka",
        });
    },
  );
});
