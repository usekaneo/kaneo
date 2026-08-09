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

async function listProjects(workspaceId: string, includeArchived = false) {
  const { app } = createApp();
  const response = await app.request(
    `/api/project?workspaceId=${workspaceId}${
      includeArchived ? "&includeArchived=true" : ""
    }`,
  );
  return (await response.json()) as ProjectListEntry[];
}

function archiveRequest(projectId: string) {
  const { app } = createApp();
  return app.request(`/api/project/${projectId}/archive`, { method: "PUT" });
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

  it("rejects a negative position", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(member.workspace.id, [
      { id: project.id, position: -1 },
    ]);

    expect(response.status).toBe(400);
  });

  it("rejects a duplicated project id", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(member.workspace.id, [
      { id: project.id, position: 0 },
      { id: project.id, position: 1 },
    ]);

    expect(response.status).toBe(400);
  });

  it("normalizes out-of-range and sparse positions to 0..n-1", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project: first } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "First",
    });
    const { project: second } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Second",
    });
    const { project: third } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Third",
    });

    mockAuthenticatedSession(member.user);

    // A client-supplied position near the integer ceiling must not be stored
    // verbatim: `createProject` appends at max(position) + 1, so persisting it
    // would overflow the column on the next create in this workspace.
    const response = await reorderRequest(member.workspace.id, [
      { id: third.id, position: 0 },
      { id: first.id, position: 5 },
      { id: second.id, position: 2_000_000_000 },
    ]);

    expect(response.status).toBe(200);

    const projects = await listProjects(member.workspace.id);
    expect(projects.map((project) => project.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
    expect(projects.map((project) => project.position)).toEqual([0, 1, 2]);
  });

  it("keeps workspace projects missing from the payload in place", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project: first } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "First",
    });
    const { project: second } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Second",
    });
    // Clients only ever see non-archived projects, so a partial payload is
    // legitimate; the omitted project keeps a slot in the ordering.
    const { project: omitted } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Omitted",
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
      omitted.id,
    ]);
    expect(projects.map((project) => project.position)).toEqual([0, 1, 2]);
  });

  it("keeps an archived project's slot in the ordering", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project: first } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "First",
    });
    // Deliberately in the middle: an archived project seeded last would be
    // indistinguishable from one the controller shunted to the end.
    const { project: archived } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Archived",
    });
    const { project: second } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Second",
    });

    mockAuthenticatedSession(member.user);

    expect((await archiveRequest(archived.id)).status).toBe(200);

    // The client never sees the archived project, so it cannot send it. The
    // controller has to leave it where it is and slot the payload around it.
    const response = await reorderRequest(member.workspace.id, [
      { id: second.id, position: 0 },
      { id: first.id, position: 1 },
    ]);

    expect(response.status).toBe(200);

    const visibleProjects = await listProjects(member.workspace.id);
    expect(visibleProjects.map((project) => project.id)).toEqual([
      second.id,
      first.id,
    ]);

    const allProjects = await listProjects(member.workspace.id, true);
    expect(allProjects.map((project) => project.id)).toEqual([
      second.id,
      archived.id,
      first.id,
    ]);
    expect(allProjects.map((project) => project.position)).toEqual([0, 1, 2]);
  });

  it("rejects an empty payload", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    await createProjectFixture({ workspaceId: member.workspace.id });

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(member.workspace.id, []);

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
