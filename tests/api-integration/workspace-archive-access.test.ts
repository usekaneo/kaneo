import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { findAllIntegrationsByGiteaRepo } from "../../apps/api/src/plugins/gitea/services/integration-lookup";
import { getSyncIntegrations } from "../../apps/api/src/plugins/sync/integrations";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: vi.fn(async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  })),
}));

beforeEach(resetTestDatabase);

function setArchived(workspaceId: string, archived: boolean) {
  return db
    .update(schema.workspaceTable)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(schema.workspaceTable.id, workspaceId));
}

async function codeOf(response: Response) {
  return ((await response.json()) as { code?: string }).code;
}

async function seed() {
  const { user: member, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Task", number: 1 })
    .returning();
  return { member, workspace, project, task };
}

describe("an archived workspace over HTTP", () => {
  it("returns WORKSPACE_ARCHIVED to members and administrators, and 404 to outsiders", async () => {
    const { member, workspace, project, task } = await seed();
    const outsider = await createWorkspaceMember();
    const admin = await createInstanceAdmin();
    const paths = [
      `/project?workspaceId=${workspace.id}`,
      `/project/${project.id}`,
      `/task/${task.id}`,
      `/workspace/${workspace.id}/capabilities`,
      `/workspace/${workspace.id}`,
    ];

    mockAuthenticatedSession(member);
    for (const path of paths) {
      expect((await projectAccessApi()(path)).status).toBe(200);
    }

    await setArchived(workspace.id, true);
    for (const user of [member, admin]) {
      vi.restoreAllMocks();
      mockAuthenticatedSession(user);
      for (const path of paths) {
        const response = await projectAccessApi()(path);
        expect(response.status, `${path} for ${user.id}`).toBe(403);
        expect(await codeOf(response)).toBe("WORKSPACE_ARCHIVED");
      }
    }

    vi.restoreAllMocks();
    mockAuthenticatedSession(outsider.user);
    for (const path of paths) {
      expect((await projectAccessApi()(path)).status).toBe(404);
    }
  });

  it("drops it from the member's workspace list until it is restored", async () => {
    const { member, workspace } = await seed();
    mockAuthenticatedSession(member);
    const listIds = async () =>
      (
        (await (await projectAccessApi()("/workspace")).json()) as {
          id: string;
        }[]
      ).map((entry) => entry.id);

    expect(await listIds()).toEqual([workspace.id]);
    await setArchived(workspace.id, true);
    expect(await listIds()).toEqual([]);
    await setArchived(workspace.id, false);
    expect(await listIds()).toEqual([workspace.id]);
  });

  it("rejects the member's API keys, which MCP clients use", async () => {
    const { member, workspace, task } = await seed();
    const { key } = await auth.api.createApiKey({
      body: { userId: member.id, name: "Archive test" },
    });
    const { app } = createApp();
    const request = (headers: Record<string, string>) =>
      app.request(`/api/task/${task.id}`, { headers });

    expect((await request({ "x-api-key": key })).status).toBe(200);
    await setArchived(workspace.id, true);
    for (const headers of [
      { "x-api-key": key },
      { authorization: `Bearer ${key}` },
    ]) {
      const response = await request(headers);
      expect(response.status).toBe(403);
      expect(await codeOf(response)).toBe("WORKSPACE_ARCHIVED");
    }
  });

  it("hides its notifications until it is restored", async () => {
    const { member, workspace, task } = await seed();
    await db.insert(schema.notificationTable).values({
      userId: member.id,
      title: "Task notification",
      type: "task_assigned",
      resourceId: task.id,
      resourceType: "task",
    });
    mockAuthenticatedSession(member);
    const count = async () =>
      ((await (await projectAccessApi()("/notification")).json()) as unknown[])
        .length;

    expect(await count()).toBe(1);
    await setArchived(workspace.id, true);
    expect(await count()).toBe(0);
    await setArchived(workspace.id, false);
    expect(await count()).toBe(1);
  });
});

describe("an archived workspace's public links", () => {
  it("stops serving public boards, descriptions, assets, and calendar feeds", async () => {
    const { member, workspace, project, task } = await seed();
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    const [asset] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: workspace.id,
        projectId: project.id,
        taskId: task.id,
        objectKey: randomUUID(),
        filename: "image.png",
        mimeType: "image/png",
        size: 3,
        surface: "description",
        createdBy: member.id,
      })
      .returning();
    const [feed] = await db
      .insert(schema.calendarFeedTable)
      .values({
        projectId: project.id,
        userId: member.id,
        token: randomBytes(32).toString("hex"),
        labelIds: [],
        timeZone: "UTC",
      })
      .returning();
    const paths = [
      `/public-project/${project.id}`,
      `/public-project/${project.id}/description?offset=0`,
      `/public-project/${project.id}/task/${task.id}/description?offset=0`,
      `/asset/${asset.id}`,
      `/calendar-feed/${feed.token}/calendar.ics`,
    ];
    mockAnonymousSession();

    for (const path of paths) {
      expect((await projectAccessApi()(path)).status, path).toBe(200);
    }
    await setArchived(workspace.id, true);
    for (const path of paths) {
      expect((await projectAccessApi()(path)).status, path).toBe(404);
    }
    await setArchived(workspace.id, false);
    for (const path of paths) {
      expect((await projectAccessApi()(path)).status, path).toBe(200);
    }
  });
});

describe("an archived workspace's integrations", () => {
  it("are skipped by webhook and sync lookups", async () => {
    const { workspace, project } = await seed();
    await db.insert(schema.integrationTable).values({
      projectId: project.id,
      type: "gitea",
      isActive: true,
      config: JSON.stringify({
        baseUrl: "https://gitea.example.com",
        repositoryOwner: "acme",
        repositoryName: "app",
        syncRules: { taskCreated: true },
      }),
    });
    const lookup = () =>
      findAllIntegrationsByGiteaRepo(
        "https://gitea.example.com",
        "acme",
        "app",
      );

    expect(await lookup()).toHaveLength(1);
    const syncedBefore = await getSyncIntegrations(project.id);

    await setArchived(workspace.id, true);
    expect(await lookup()).toEqual([]);
    expect(await getSyncIntegrations(project.id)).toEqual([]);

    await setArchived(workspace.id, false);
    expect(await lookup()).toHaveLength(1);
    expect(await getSyncIntegrations(project.id)).toHaveLength(
      syncedBefore.length,
    );
  });
});

describe("an archived workspace through Better Auth organization endpoints", () => {
  async function organizationFixture() {
    const { app } = createApp();
    const member = await signUpWithSession(app, {
      email: "member@example.com",
      name: "Member",
    });
    const outsider = await signUpWithSession(app, {
      email: "outsider@example.com",
      name: "Outsider",
    });
    const invitee = await signUpWithSession(app, {
      email: "invitee@example.com",
      name: "Invitee",
    });
    // Listing one's own invitations requires a verified email.
    await db
      .update(schema.userTable)
      .set({ emailVerified: true })
      .where(eq(schema.userTable.id, invitee.userId));
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({
        name: "Archived org",
        slug: `archived-${randomUUID()}`,
        createdAt: new Date(),
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: member.userId,
      role: "owner",
      joinedAt: new Date(),
    });
    const [invitation] = await db
      .insert(schema.invitationTable)
      .values({
        workspaceId: workspace.id,
        inviterId: member.userId,
        email: "invitee@example.com",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    const call = (
      cookies: string,
      path: string,
      body?: Record<string, unknown>,
    ) =>
      app.request(`/api${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          cookie: cookies,
          origin: "http://localhost:5173",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    return { member, outsider, invitee, workspace, invitation, call };
  }

  it("hides it from lists and blocks reads, activation, and invitations", async () => {
    const { member, outsider, invitee, workspace, invitation, call } =
      await organizationFixture();
    const listed = async () =>
      (
        (await (
          await call(member.cookies, "/auth/organization/list")
        ).json()) as { id: string }[]
      ).map((entry) => entry.id);
    const invitationIds = async () =>
      (
        (await (
          await call(
            invitee.cookies,
            "/auth/organization/list-user-invitations",
          )
        ).json()) as { id: string }[]
      ).map((entry) => entry.id);
    const pending = async () =>
      (
        (await (await call(invitee.cookies, "/invitation/pending")).json()) as {
          id: string;
        }[]
      ).map((entry) => entry.id);

    expect(await listed()).toEqual([workspace.id]);
    expect(await invitationIds()).toEqual([invitation.id]);
    expect(await pending()).toEqual([invitation.id]);

    await setArchived(workspace.id, true);

    expect(await listed()).toEqual([]);
    expect(await invitationIds()).toEqual([]);
    expect(await pending()).toEqual([]);
    const details = await call(
      invitee.cookies,
      `/invitation/public/${invitation.id}`,
    );
    expect(((await details.json()) as { valid: boolean }).valid).toBe(false);

    for (const response of [
      await call(
        invitee.cookies,
        `/auth/organization/get-invitation?id=${invitation.id}`,
      ),
      await call(
        member.cookies,
        `/auth/organization/get-full-organization?organizationId=${workspace.id}`,
      ),
      await call(
        member.cookies,
        `/auth/organization/get-full-organization?organizationSlug=${workspace.slug}`,
      ),
      await call(member.cookies, "/auth/organization/set-active", {
        organizationId: workspace.id,
      }),
      await call(member.cookies, "/auth/organization/update", {
        organizationId: workspace.id,
        data: { name: "Renamed" },
      }),
      await call(invitee.cookies, "/auth/organization/accept-invitation", {
        invitationId: invitation.id,
      }),
    ]) {
      expect(response.status).toBe(403);
      expect(await codeOf(response)).toBe("WORKSPACE_ARCHIVED");
    }

    // Outsiders cannot tell an archived workspace from one they cannot read.
    const probe = await call(
      outsider.cookies,
      `/auth/organization/get-full-organization?organizationSlug=${workspace.slug}`,
    );
    expect(probe.status).toBe(403);
    expect(await codeOf(probe)).toBe("MISSING_PERMISSION");

    // Leaving the archived workspace as the active one still works.
    const cleared = await call(
      member.cookies,
      "/auth/organization/set-active",
      {
        organizationId: null,
      },
    );
    expect(cleared.status).toBe(200);

    const [stored] = await db
      .select({ name: schema.workspaceTable.name })
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, workspace.id));
    expect(stored?.name).toBe("Archived org");
    const members = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, workspace.id));
    expect(members).toHaveLength(1);
  });

  it("blocks the archived workspace when it is the session's active one", async () => {
    const { member, workspace, call } = await organizationFixture();
    expect(
      (
        await call(member.cookies, "/auth/organization/set-active", {
          organizationId: workspace.id,
        })
      ).status,
    ).toBe(200);

    await setArchived(workspace.id, true);
    const response = await call(
      member.cookies,
      "/auth/organization/get-full-organization",
    );
    expect(response.status).toBe(403);
    expect(await codeOf(response)).toBe("WORKSPACE_ARCHIVED");

    await setArchived(workspace.id, false);
    expect(
      (await call(member.cookies, "/auth/organization/get-full-organization"))
        .status,
    ).toBe(200);
  });
});
