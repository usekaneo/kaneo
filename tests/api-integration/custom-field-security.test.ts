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

async function fixture(role = "admin") {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Private task",
      number: 1,
      status: "to-do",
      columnId: columns.todo.id,
    })
    .returning();
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({
      projectId: project.id,
      name: "Private field",
      type: "text",
      required: false,
      defaultValue: "private-default",
      position: 0,
    })
    .returning();
  await db
    .insert(schema.customFieldValueTable)
    .values({ taskId: task.id, fieldId: field.id, value: "private-value" });
  const { app } = createApp();
  return {
    member,
    project,
    task,
    app,
    paths: [
      `/api/custom-field/project/${project.id}`,
      `/api/custom-field/project/${project.id}/values`,
      `/api/custom-field/task/${task.id}`,
      `/api/custom-field/project/${project.id}/filter-values`,
    ],
  };
}

describe("custom field read authorization", () => {
  for (const authentication of ["api-key", "custom-role"] as const) {
    it.each([
      [{}, [403, 403, 403, 403]],
      [{ project: ["read"] }, [200, 403, 403, 403]],
      [{ task: ["read"] }, [403, 200, 200, 200]],
      [{ project: ["read"], task: ["read"] }, [200, 200, 200, 200]],
    ] as [Record<string, string[]>, number[]][])(
      `${authentication} respects permission map %j`,
      async (permissions, expected) => {
        const { member, app, paths } = await fixture(
          authentication === "custom-role" ? "limited" : "admin",
        );
        const headers: Record<string, string> = {};
        if (authentication === "custom-role") {
          await db.insert(schema.workspaceRoleTable).values({
            workspaceId: member.workspace.id,
            role: "limited",
            permission: JSON.stringify(permissions),
          });
          mockAuthenticatedSession(member.user);
        } else {
          mockAnonymousSession();
          const key = `kaneo_test_${randomUUID()}`;
          await db.insert(schema.apikeyTable).values({
            referenceId: member.user.id,
            userId: member.user.id,
            key: createHash("sha256").update(key).digest("base64url"),
            name: "scoped test key",
            createdAt: new Date(),
            updatedAt: new Date(),
            permissions: JSON.stringify(permissions),
            enabled: true,
          });
          headers.Authorization = `Bearer ${key}`;
        }
        for (const [i, path] of paths.entries()) {
          const response = await app.request(path, { headers });
          expect(response.status, path).toBe(expected[i]);
          const body = await response.text();
          if (expected[i] === 403) {
            expect(body).not.toContain("private-default");
            expect(body).not.toContain("private-value");
            expect(body).not.toContain("Private field");
          } else {
            expect(body).toContain(
              i === 0 ? "private-default" : "private-value",
            );
          }
        }
      },
    );
  }

  it("does not let read scopes bypass workspace membership", async () => {
    const { app, paths } = await fixture();
    const outsider = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(outsider.user);
    for (const path of paths)
      expect((await app.request(path)).status).toBe(403);
  });
});

describe("date defaults", () => {
  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "2026-00-01",
    "2026-01-00",
    "2026-02-30T12:00:00Z",
    "September 19, 2026",
  ])(
    "rejects invalid default %s without definition or backfill writes",
    async (defaultValue) => {
      const { member, project, app } = await fixture();
      mockAuthenticatedSession(member.user);
      const response = await app.request("/api/custom-field", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          name: "Deadline",
          type: "date",
          required: true,
          defaultValue,
        }),
      });
      expect(response.status).toBe(400);
      expect(
        await db.select().from(schema.customFieldDefinitionTable),
      ).toHaveLength(1);
      expect(await db.select().from(schema.customFieldValueTable)).toHaveLength(
        1,
      );
    },
  );

  it.each(["2028-02-29", "2028-02-29T12:00:00Z", " 2028-02-29 "])(
    "accepts %s and uses it for existing and newly created tasks",
    async (defaultValue) => {
      const { member, project, app } = await fixture();
      mockAuthenticatedSession(member.user);
      // Fixtures inserted a task directly; synchronize its project counter.
      const { eq } = await import("drizzle-orm");
      await db
        .update(schema.projectTable)
        .set({ lastTaskNumber: 1 })
        .where(eq(schema.projectTable.id, project.id));
      const response = await app.request("/api/custom-field", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          name: "Deadline",
          type: "date",
          required: true,
          defaultValue,
        }),
      });
      expect(response.status).toBe(200);
      const field = await response.json();
      const created = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "New task",
          description: "",
          priority: "low",
          status: "to-do",
        }),
      });
      expect(created.status, await created.text()).toBe(200);
      const values = await db
        .select()
        .from(schema.customFieldValueTable)
        .where(eq(schema.customFieldValueTable.fieldId, field.id));
      expect(values).toHaveLength(2);
      expect(values.every((value) => value.value === defaultValue.trim())).toBe(
        true,
      );
    },
  );
});
