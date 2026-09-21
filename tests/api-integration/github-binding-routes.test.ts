import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { handleLabelCreated } from "../../apps/api/src/plugins/github/webhooks/label-created";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const m = vi.hoisted(() => ({ installation: vi.fn(), permission: vi.fn() }));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({
    octokit: { rest: { apps: { getRepoInstallation: m.installation } } },
    getInstallationOctokit: async () => ({
      rest: {
        users: { getById: async () => ({ data: { id: 30, login: "admin" } }) },
        repos: {
          getCollaboratorPermissionLevel: m.permission,
          get: async () => ({
            data: { id: 20, owner: { login: "owner" }, name: "repo" },
          }),
        },
      },
    }),
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  m.installation.mockResolvedValue({ data: { id: 10 } });
  m.permission.mockResolvedValue({ data: { permission: "admin" } });
});

async function fixture(role = "admin") {
  const member = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  return { ...member, project };
}
function calls(projectId: string) {
  return [
    [
      `/api/github-integration/project/${projectId}`,
      {
        method: "POST",
        body: JSON.stringify({
          repositoryOwner: "owner",
          repositoryName: "repo",
        }),
      },
    ],
    [
      "/api/github-integration/verify",
      {
        method: "POST",
        body: JSON.stringify({
          projectId,
          repositoryOwner: "owner",
          repositoryName: "repo",
        }),
      },
    ],
    [`/api/github-integration/repositories/${projectId}`, { method: "GET" }],
  ] as const;
}

describe("GitHub binding HTTP and webhook tenant boundaries", () => {
  it("rejects an owner's unrestricted API key before repository provider calls", async () => {
    const owner = await fixture();
    mockAnonymousSession();
    const key = "kaneo_local_binding_test_key";
    await db.insert(schema.apikeyTable).values({
      referenceId: owner.user.id,
      userId: owner.user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      name: "local test",
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    });
    const { app } = createApp();
    for (const [url, options] of calls(owner.project.id)) {
      const response = await app.request(url, {
        ...options,
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${key}`,
        },
      });
      expect(response.status).toBe(403);
    }
    expect(m.installation).not.toHaveBeenCalled();
    expect(await db.query.integrationTable.findMany()).toHaveLength(0);
  });

  it("denies members and foreign-workspace administrators before provider lookup", async () => {
    const member = await fixture("member");
    const outsider = await fixture();
    const { app } = createApp();
    for (const user of [member.user, outsider.user]) {
      mockAuthenticatedSession(user);
      for (const [url, options] of calls(member.project.id)) {
        const response = await app.request(url, {
          ...options,
          headers: { "content-type": "application/json" },
        });
        expect(response.status).toBe(403);
      }
    }
    expect(m.installation).not.toHaveBeenCalled();
  });

  it("requires a completed OAuth account and permits independently authorized tenant bindings", async () => {
    const owners = [await fixture(), await fixture()];
    const { app } = createApp();
    const connect = (projectId: string) =>
      app.request(calls(projectId)[0][0], {
        ...calls(projectId)[0][1],
        headers: { "content-type": "application/json" },
      });
    mockAuthenticatedSession(owners[0].user);
    expect((await connect(owners[0].project.id)).status).toBe(403);
    expect(m.installation).not.toHaveBeenCalled();
    for (const owner of owners) {
      await db.insert(schema.accountTable).values({
        id: `account-${owner.user.id}`,
        userId: owner.user.id,
        providerId: "github",
        accountId: "30",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockAuthenticatedSession(owner.user);
      expect((await connect(owner.project.id)).status).toBe(200);
    }
    const bindings = await db.query.integrationTable.findMany();
    expect(bindings).toHaveLength(2);
    for (const binding of bindings)
      expect(JSON.parse(binding.config)).toMatchObject({
        repositoryId: 20,
        installationId: 10,
        verifiedGithubAccountId: "30",
      });
    m.permission.mockResolvedValue({ data: { permission: "read" } });
    const forbidden = await connect(owners[1].project.id);
    expect(forbidden.status).toBe(403);
    expect(await forbidden.text()).not.toContain(owners[0].workspace.id);
  });

  it("an actual label webhook mutates only a verified matching active tenant", async () => {
    const configs = [
      {
        repositoryId: 20,
        installationId: 10,
        verifiedGithubAccountId: "30",
        verifiedByUserId: "operator",
      },
      { installationId: 10 },
      {
        repositoryId: 21,
        installationId: 10,
        verifiedGithubAccountId: "30",
        verifiedByUserId: "operator",
      },
      {
        repositoryId: 20,
        installationId: 11,
        verifiedGithubAccountId: "30",
        verifiedByUserId: "operator",
      },
    ];
    const tenants = [];
    for (const config of configs) {
      const tenant = await fixture();
      tenants.push(tenant);
      await db.insert(schema.integrationTable).values({
        projectId: tenant.project.id,
        type: "github",
        isActive: true,
        config: JSON.stringify({
          repositoryOwner: "owner",
          repositoryName: "repo",
          ...config,
        }),
      });
    }
    await handleLabelCreated({
      action: "created",
      label: { name: "Provider label", color: "123456" },
      repository: { id: 20, owner: { login: "owner" }, name: "repo" },
      installation: { id: 10 },
    });
    const labels = await db.query.labelTable.findMany();
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({
      workspaceId: tenants[0].workspace.id,
      name: "Provider label",
    });
    await handleLabelCreated({
      action: "created",
      label: { name: "Missing installation", color: "123456" },
      repository: { id: 20, owner: { login: "owner" }, name: "repo" },
    });
    expect(await db.query.labelTable.findMany()).toHaveLength(1);
  });
});
