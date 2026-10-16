import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { resolveImportAssignees } from "../../apps/api/src/task/resolve-import-assignees";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

beforeEach(resetTestDatabase);

async function fixture() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const importUsers = async (references: (string | null | undefined)[]) => {
    const response = await app.request(`/api/task/import/${project.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: references.map((userId, index) => ({
          title: `Task ${index}`,
          status: "to-do",
          userId,
        })),
      }),
    });
    expect(response.status).toBe(200);
    return response.json();
  };
  return { user, workspace, project, importUsers };
}

describe("JSON import assignees", () => {
  it("resolves member emails to opaque user IDs and preserves ID and unassigned imports", async () => {
    const { user, project, importUsers } = await fixture();
    const result = await importUsers([
      `  ${user.email.toUpperCase()}  `,
      user.id,
      null,
      "",
      undefined,
    ]);
    expect(result.results.successful).toBe(5);
    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    expect(tasks.filter((task) => task.userId === user.id)).toHaveLength(2);
    expect(tasks.filter((task) => task.userId === null)).toHaveLength(3);
    expect(tasks.some((task) => task.userId === user.email)).toBe(false);
  });

  it("resolves an email when the same user has duplicate workspace memberships", async () => {
    const { user, workspace, importUsers } = await fixture();
    await db.insert(schema.workspaceUserTable).values({
      userId: user.id,
      workspaceId: workspace.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const result = await importUsers([
      user.email,
      `  ${user.email.toUpperCase()}  `,
    ]);
    expect(result.results.successful).toBe(2);
    expect(result.results.failed).toBe(0);
    expect(
      result.results.tasks.map(
        (entry: { task: { userId: string } }) => entry.task.userId,
      ),
    ).toEqual([user.id, user.id]);
  });

  it("prefers an actual user ID over another eligible user's matching email", async () => {
    const { user, workspace, importUsers } = await fixture();
    const [idHolder] = await db
      .insert(schema.userTable)
      .values({
        id: user.email,
        email: `${user.id}@id-holder.example.com`,
        emailVerified: true,
        name: "ID Holder",
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      userId: idHolder.id,
      workspaceId: workspace.id,
      role: "member",
      joinedAt: new Date(),
    });
    const result = await importUsers([idHolder.id, user.id]);
    expect(result.results.successful).toBe(2);
    expect(result.results.failed).toBe(0);
    expect(
      result.results.tasks.map(
        (entry: { task: { userId: string } }) => entry.task.userId,
      ),
    ).toEqual([idHolder.id, user.id]);
  });

  it("rejects an ineligible user ID instead of resolving another user's matching email", async () => {
    const { user, project, importUsers } = await fixture();
    await db.insert(schema.userTable).values({
      id: user.email,
      email: `${user.id}@nonmember.example.com`,
      emailVerified: true,
      name: "Nonmember ID Holder",
    });
    const result = await importUsers([
      user.email,
      user.email.toUpperCase(),
      user.id,
    ]);
    expect(result.results.successful).toBe(2);
    expect(result.results.failed).toBe(1);
    expect(result.results.tasks[0]).toMatchObject({
      success: false,
      error: "Assignee is not a member of this workspace",
    });
    for (const index of [1, 2]) {
      expect(result.results.tasks[index]).toMatchObject({
        success: true,
        task: { userId: user.id },
      });
    }
    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    expect(tasks.map((task) => task.title).sort()).toEqual([
      "Task 1",
      "Task 2",
    ]);
    expect(tasks.every((task) => task.userId === user.id)).toBe(true);
  });

  it("keeps indexed ID-only imports free of email scans", async () => {
    const { user, workspace } = await fixture();
    const queries = vi.spyOn(getDatabasePool(), "query");
    try {
      const resolved = await resolveImportAssignees(
        [user.id, "missing-user-id"],
        workspace.id,
      );
      expect(resolved.get(user.id)).toBe(user.id);
      expect(resolved.has("missing-user-id")).toBe(false);
      expect(queries).toHaveBeenCalledTimes(1);
      const statement = queries.mock.calls[0]?.[0];
      const text =
        typeof statement === "string"
          ? statement
          : statement && typeof statement === "object" && "text" in statement
            ? statement.text
            : "";
      expect(text).not.toMatch(/lower\s*\(/i);
    } finally {
      queries.mockRestore();
    }
  });

  it("rejects another workspace's users without revealing whether the email exists", async () => {
    const { importUsers } = await fixture();
    const outsider = await createWorkspaceMember();
    const result = await importUsers([
      outsider.user.email,
      outsider.user.id,
      "unknown@example.com",
    ]);
    expect(result.results.successful).toBe(0);
    expect(result.results.failed).toBe(3);
    expect(
      result.results.tasks.map((entry: { error: string }) => entry.error),
    ).toEqual(Array(3).fill("Assignee is not a member of this workspace"));
  });

  it("still enforces project access after resolving an email", async () => {
    const { workspace, importUsers } = await fixture();
    const restricted = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      userId: restricted.user.id,
      workspaceId: workspace.id,
      role: "member",
      joinedAt: new Date(),
    });
    const { project: allowed } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await restrictToProjects(workspace.id, restricted.user.id, [allowed.id]);
    const result = await importUsers([
      restricted.user.email,
      restricted.user.id,
    ]);
    expect(result.results.successful).toBe(0);
    expect(
      result.results.tasks.map((entry: { error: string }) => entry.error),
    ).toEqual(Array(2).fill("Assignee does not have access to this project"));
  });

  it("preserves instance-admin assignment outside workspace membership", async () => {
    const { importUsers } = await fixture();
    const { user: admin } = await createWorkspaceMember();
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, admin.id));
    const result = await importUsers([admin.id, admin.email]);
    expect(result.results.successful).toBe(2);
    expect(
      result.results.tasks.map(
        (entry: { task: { userId: string } }) => entry.task.userId,
      ),
    ).toEqual([admin.id, admin.id]);
  });

  it("does not pick an arbitrary member when emails differ only by case", async () => {
    const { user, workspace, importUsers } = await fixture();
    const duplicate = await createWorkspaceMember();
    await db
      .update(schema.userTable)
      .set({ email: user.email.toUpperCase() })
      .where(eq(schema.userTable.id, duplicate.user.id));
    await db.insert(schema.workspaceUserTable).values({
      userId: duplicate.user.id,
      workspaceId: workspace.id,
      role: "member",
      joinedAt: new Date(),
    });
    const result = await importUsers([user.email, user.id]);
    expect(result.results.successful).toBe(1);
    expect(result.results.failed).toBe(1);
    expect(result.results.tasks[0].error).toBe(
      "Assignee is not a member of this workspace",
    );
    expect(result.results.tasks[1].task.userId).toBe(user.id);
  });
});
