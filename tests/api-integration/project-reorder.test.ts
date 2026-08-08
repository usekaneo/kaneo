import { beforeEach, describe, expect, it } from "vitest";
import { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type ProjectListEntry = typeof schema.projectTable.$inferSelect;

async function listProjects(workspaceId: string) {
  const { app } = createApp();
  const response = await app.request(`/api/project?workspaceId=${workspaceId}`);
  return (await response.json()) as ProjectListEntry[];
}

function reorderRequest(
  workspaceId: string,
  projects: Array<{ id: string; position: number }>,
) {
  const { app } = createApp();
  return app.request(`/api/project/reorder?workspaceId=${workspaceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projects }),
  });
}

describe("API integration: project reorder", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("persists the new order across a re-fetch", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project: first } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "First",
    });
    const { project: second } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Second",
    });

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(member.workspace.id, [
      { id: second.id, position: 0 },
      { id: first.id, position: 1 },
    ]);

    expect(response.status).toBe(200);

    const projects = await listProjects(member.workspace.id);
    expect(projects.map((project) => project.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("rejects a project that belongs to another workspace", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const outsider = await createWorkspaceMember({ role: "admin" });

    const { project: first } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "First",
    });
    const { project: second } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Second",
    });
    const { project: foreign } = await createProjectFixture({
      workspaceId: outsider.workspace.id,
    });

    mockAuthenticatedSession(member.user);

    // A caller with legitimate access to their own workspace must not be able
    // to smuggle a foreign project id into the batch.
    const response = await reorderRequest(member.workspace.id, [
      { id: second.id, position: 0 },
      { id: first.id, position: 1 },
      { id: foreign.id, position: 2 },
    ]);

    expect(response.status).toBe(400);

    // The rejected batch must not have applied partially: the two legitimate
    // ids come before the foreign one, so a per-row loop would already have
    // renumbered them by the time it failed.
    const projects = await listProjects(member.workspace.id);
    expect(projects.map((project) => project.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("rejects a fractional position", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(member.workspace.id, [
      { id: project.id, position: 1.5 },
    ]);

    expect(response.status).toBe(400);
  });

  it("rejects a member without project update permission", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });

    mockAuthenticatedSession(viewer.user);

    const response = await reorderRequest(viewer.workspace.id, [
      { id: project.id, position: 0 },
    ]);

    expect(response.status).toBe(403);
  });

  it("places a newly created project at the end of the order", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Existing",
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project?workspaceId=${member.workspace.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Newest",
          workspaceId: member.workspace.id,
          icon: "Folder",
          slug: "newest",
        }),
      },
    );

    expect(response.status).toBe(200);

    const projects = await listProjects(member.workspace.id);
    expect(projects.at(-1)?.name).toBe("Newest");
  });
});
