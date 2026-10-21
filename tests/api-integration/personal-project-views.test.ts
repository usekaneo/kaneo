import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { projectViewConfigSchema } from "../../apps/api/src/saved-view/schema";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const config = projectViewConfigSchema.parse({
  version: 1,
  search: "bug",
  filters: {
    priority: ["high"],
    negated: ["status"],
    status: ["done"],
    createdDate: ["createdThisWeek"],
  },
  sort: { field: "priority", direction: "desc" },
  layout: "list",
});
beforeEach(resetTestDatabase);
async function fixture() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const path = `/api/saved-view/projects/${project.id}`;
  const request = (method: string, id = "", body?: unknown) =>
    app.request(path + (id ? `/${id}` : ""), {
      method,
      headers: { "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { member, project, request, app, path };
}
describe("personal project views", () => {
  it("creates, reads, renames, replaces and deletes a persistent preset", async () => {
    const { request } = await fixture();
    const create = await request("POST", "", { name: "  My bugs  ", config });
    expect(create.status).toBe(201);
    const view = await create.json();
    expect(view.name).toBe("My bugs");
    expect(view.config).toEqual(config);
    expect(await (await request("GET")).json()).toEqual([view]);
    expect(
      (
        await request("PUT", view.id, {
          name: "Renamed",
          config: { ...config, layout: "board" },
        })
      ).status,
    ).toBe(200);
    expect((await (await request("GET")).json())[0]).toMatchObject({
      name: "Renamed",
      config: { layout: "board" },
    });
    expect((await request("DELETE", view.id)).status).toBe(200);
    expect(await (await request("GET")).json()).toEqual([]);
  });
  it("does not list, replace or delete another member's private view", async () => {
    const { member, request } = await fixture();
    const view = await (
      await request("POST", "", { name: "Private", config })
    ).json();
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(other.user);
    expect(await (await request("GET")).json()).toEqual([]);
    expect(
      (await request("PUT", view.id, { name: "Stolen", config })).status,
    ).toBe(404);
    expect((await request("DELETE", view.id)).status).toBe(404);
  });
  it("binds view IDs to their original project", async () => {
    const { member, request, app } = await fixture();
    const view = await (
      await request("POST", "", { name: "Private", config })
    ).json();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    expect(
      (
        await app.request(`/api/saved-view/projects/${project.id}/${view.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(404);
    expect((await request("GET")).status).toBe(200);
  });
  it("checks access again after workspace membership is revoked", async () => {
    const { member, request } = await fixture();
    const view = await (
      await request("POST", "", { name: "Private", config })
    ).json();
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, member.user.id));
    for (const [method, id] of [
      ["GET", ""],
      ["PUT", view.id],
      ["DELETE", view.id],
    ])
      expect(
        (
          await request(
            method,
            id,
            method === "PUT" ? { name: "No", config } : undefined,
          )
        ).status,
      ).toBe(404);
  });
  it("rejects unbounded, unknown and malformed configuration", async () => {
    const { request } = await fixture();
    for (const body of [
      { name: " ", config },
      { name: "x", config: { ...config, version: 2 } },
      { name: "x", config: { ...config, search: "x".repeat(1001) } },
      {
        name: "x",
        config: { ...config, filters: { assignee: Array(101).fill("u") } },
      },
      { name: "x", config: { ...config, shared: true } },
    ])
      expect((await request("POST", "", body)).status).toBe(400);
  });
  it("enforces the per-user cap across concurrent creates", async () => {
    const { member, project, request } = await fixture();
    await db.insert(schema.personalProjectViewTable).values(
      Array.from({ length: 49 }, (_, index) => ({
        projectId: project.id,
        userId: member.user.id,
        name: `View ${index}`,
        config,
      })),
    );
    const responses = await Promise.all([
      request("POST", "", { name: "A", config }),
      request("POST", "", { name: "B", config }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect((await (await request("GET")).json()).length).toBe(50);
  });
  it("cascades presets on project deletion without changing other projects", async () => {
    const { project, request } = await fixture();
    await request("POST", "", { name: "Private", config });
    await db
      .delete(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(await db.select().from(schema.personalProjectViewTable)).toEqual([]);
  });
});
