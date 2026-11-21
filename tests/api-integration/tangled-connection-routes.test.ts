import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const upstream = vi.hoisted(() => ({ available: true }));
vi.mock("../../apps/api/src/plugins/tangled/request-json", () => ({
  requestTangledJson: async () => {
    if (!upstream.available) throw new Error("upstream-unavailable");
    return {
      uri: "at://did:plc:sjazesp3pinxlmgju2va46jd/org.tangled.repo.manifest/self",
      value: {
        $type: "org.tangled.repo.manifest",
        declaration: { owner: "did:plc:owner", name: "repo" },
      },
    };
  },
}));

beforeEach(async () => {
  upstream.available = true;
  await resetTestDatabase();
});

async function fixture(role = "admin") {
  const member = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  return { ...member, project };
}

const connection = {
  baseUrl: "https://tangled.org",
  repositoryId: "did:plc:owner/repo",
  repositoryDid: "did:plc:sjazesp3pinxlmgju2va46jd",
  repositoryUrl: "https://tangled.org/@owner/repo",
  branchPattern: "{number}",
  isActive: true,
  webhookSecret: "integration-test-webhook-secret",
};

function request(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
  method: string,
  body?: unknown,
) {
  return app.request(`/api/tangled-integration/project/${projectId}`, {
    method,
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("Tangled project connection routes", () => {
  it("allows project readers to GET a disconnected connection but requires manage_settings to connect", async () => {
    const reader = await fixture("member");
    mockAuthenticatedSession(reader.user);
    const { app } = createApp();

    const disconnected = await request(app, reader.project.id, "GET");
    expect(disconnected.status).toBe(200);
    expect(await disconnected.json()).toBeNull();

    const denied = await request(app, reader.project.id, "POST", connection);
    expect(denied.status).toBe(403);
    expect(await db.query.integrationTable.findMany()).toHaveLength(0);

    const manager = await fixture("admin");
    mockAuthenticatedSession(manager.user);
    const connected = await request(
      app,
      manager.project.id,
      "POST",
      connection,
    );
    expect(connected.status).toBe(200);
    const payload = await connected.json();
    expect(payload).toMatchObject({
      baseUrl: connection.baseUrl,
      repositoryId: connection.repositoryId,
      repositoryDid: connection.repositoryDid,
      repositoryUrl: connection.repositoryUrl,
      branchPattern: connection.branchPattern,
      isActive: connection.isActive,
    });
    expect(JSON.stringify(payload)).not.toContain(connection.webhookSecret);
    const [stored] = await db.query.integrationTable.findMany();
    expect(stored?.config).toContain(connection.webhookSecret);
  });

  it("does not expose a connection from another workspace", async () => {
    const owner = await fixture("admin");
    const outsider = await fixture("admin");
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const connected = await request(app, owner.project.id, "POST", connection);
    expect(connected.status).toBe(200);

    mockAuthenticatedSession(outsider.user);
    const hidden = await request(app, owner.project.id, "GET");
    expect(hidden.status).toBe(404);
    expect(await hidden.text()).not.toContain(connection.webhookSecret);
  });

  it("rejects a webhook identity from a different repository", async () => {
    const manager = await fixture("admin");
    mockAuthenticatedSession(manager.user);
    const { app } = createApp();
    const response = await request(app, manager.project.id, "POST", {
      ...connection,
      repositoryId: "did:plc:other/repository",
    });
    expect(response.status).toBe(400);
    expect(await db.query.integrationTable.findMany()).toHaveLength(0);
  });

  it("allows disabling an existing connection while the read API is unavailable", async () => {
    const manager = await fixture("admin");
    mockAuthenticatedSession(manager.user);
    const { app } = createApp();
    expect(
      (await request(app, manager.project.id, "POST", connection)).status,
    ).toBe(200);
    upstream.available = false;
    const response = await request(app, manager.project.id, "PATCH", {
      isActive: false,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ isActive: false });
    const activation = await request(app, manager.project.id, "PATCH", {
      isActive: true,
    });
    expect(activation.status).toBe(502);
    expect(await db.query.integrationTable.findFirst()).toMatchObject({
      isActive: false,
    });
  });

  it("rejects invalid create and update request bodies", async () => {
    const manager = await fixture("admin");
    mockAuthenticatedSession(manager.user);
    const { app } = createApp();

    const invalidCreate = await request(app, manager.project.id, "POST", {
      ...connection,
      baseUrl: "http://tangled.org",
    });
    expect(invalidCreate.status).toBe(400);

    const connected = await request(
      app,
      manager.project.id,
      "POST",
      connection,
    );
    expect(connected.status).toBe(200);
    const invalidUpdate = await request(app, manager.project.id, "PATCH", {
      baseUrl: "http://tangled.org",
    });
    expect(invalidUpdate.status).toBe(400);
  });
});
