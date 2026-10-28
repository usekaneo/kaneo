import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const weekly = { frequency: "weekly", interval: 1, timeZone: "UTC" } as const;

describe("API integration: recurrence permissions and project moves", () => {
  beforeEach(resetTestDatabase);

  it.each(["custom-role", "api-key"] as const)(
    "%s needs task:create to set a rule but only task:update to clear it",
    async (authentication) => {
      const member = await createWorkspaceMember({
        role: authentication === "custom-role" ? "editor" : "admin",
      });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          columnId: columns.todo.id,
          status: columns.todo.slug,
          title: "Weekly report",
        })
        .returning();
      const permissions = { task: ["read", "update"], project: ["read"] };
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      let grantCreate: () => Promise<unknown>;
      if (authentication === "custom-role") {
        const [role] = await db
          .insert(schema.workspaceRoleTable)
          .values({
            workspaceId: member.workspace.id,
            role: "editor",
            permission: JSON.stringify(permissions),
          })
          .returning();
        mockAuthenticatedSession(member.user);
        grantCreate = () =>
          db
            .update(schema.workspaceRoleTable)
            .set({
              permission: JSON.stringify({
                ...permissions,
                task: [...permissions.task, "create"],
              }),
            })
            .where(eq(schema.workspaceRoleTable.id, role.id));
      } else {
        mockAnonymousSession();
        const key = `kaneo_test_${randomUUID()}`;
        const [storedKey] = await db
          .insert(schema.apikeyTable)
          .values({
            referenceId: member.user.id,
            userId: member.user.id,
            key: createHash("sha256").update(key).digest("base64url"),
            name: "update-only",
            createdAt: new Date(),
            updatedAt: new Date(),
            permissions: JSON.stringify(permissions),
            enabled: true,
          })
          .returning();
        headers.Authorization = `Bearer ${key}`;
        grantCreate = () =>
          db
            .update(schema.apikeyTable)
            .set({
              permissions: JSON.stringify({
                ...permissions,
                task: [...permissions.task, "create"],
              }),
            })
            .where(eq(schema.apikeyTable.id, storedKey.id));
      }
      const { app } = createApp();
      const setRule = (recurrence: typeof weekly | null) =>
        app.request(`/api/task/recurrence/${task.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ recurrence }),
        });

      const directCreate = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: "Forbidden",
          description: "",
          status: "to-do",
          priority: "no-priority",
        }),
      });
      expect(directCreate.status).toBe(403);
      expect((await setRule(weekly)).status).toBe(403);
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        }),
      ).toMatchObject({ recurrence: null });

      // A series configured by another member remains stoppable by an editor.
      await db
        .update(schema.taskTable)
        .set({ recurrence: weekly })
        .where(eq(schema.taskTable.id, task.id));
      expect((await setRule(null)).status).toBe(200);
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        }),
      ).toMatchObject({ recurrence: null });

      await grantCreate();
      expect((await setRule(weekly)).status).toBe(200);
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        }),
      ).toMatchObject({ recurrence: weekly });
    },
  );

  it.each(["done", "to-do"])(
    "continues a recurring task moved to another project's %s column",
    async (destinationStatus) => {
      const member = await createWorkspaceMember();
      const source = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const destination = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: source.project.id,
          columnId: source.columns.todo.id,
          status: "to-do",
          title: "Weekly report",
          startDate: new Date("2026-03-09T00:00:00Z"),
          dueDate: new Date("2026-03-10T00:00:00Z"),
          recurrence: weekly,
        })
        .returning();
      const created: {
        taskId: string;
        projectId: string;
        initiatorId?: string;
      }[] = [];
      const updated: string[] = [];
      await subscribeToEvent<(typeof created)[number]>(
        "task.created",
        async (data) => {
          created.push(data);
        },
      );
      await subscribeToEvent<{ taskId: string }>(
        "task.updated",
        async (data) => {
          updated.push(data.taskId);
        },
      );
      mockAuthenticatedSession(member.user);
      const { app } = createApp();
      const response = await app.request(`/api/task/move/${task.id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "X-Kaneo-Window-Id": "recurrence-move",
        },
        body: JSON.stringify({
          destinationProjectId: destination.project.id,
          destinationStatus,
        }),
      });
      expect(response.status).toBe(200);

      if (destinationStatus === "to-do") {
        expect(await db.query.taskTable.findMany()).toHaveLength(1);
        const completed = await app.request(`/api/task/status/${task.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "done" }),
        });
        expect(completed.status).toBe(200);
      }

      await vi.waitFor(async () => {
        const tasks = await db.query.taskTable.findMany();
        expect(tasks).toHaveLength(2);
        expect(tasks.find((item) => item.id !== task.id)).toMatchObject({
          projectId: destination.project.id,
          columnId: destination.columns.todo.id,
          status: "to-do",
          startDate: new Date("2026-03-16T00:00:00Z"),
          dueDate: new Date("2026-03-17T00:00:00Z"),
          recurrence: weekly,
        });
        expect(tasks.find((item) => item.id === task.id)).toMatchObject({
          recurrence: null,
        });
        expect(created).toHaveLength(1);
        expect(created[0]).toMatchObject({ projectId: destination.project.id });
        expect(created[0]?.initiatorId).toBeUndefined();
        expect(updated).toContain(task.id);
      });
    },
  );
});
