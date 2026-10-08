import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { stopPluginJobs } from "../../apps/api/src/plugin-host/context/plugin-jobs";
import { startPluginEventBridge } from "../../apps/api/src/plugin-host/events/event-bridge";
import { loadPlugins } from "../../apps/api/src/plugin-host/loader/load-plugins";
import { clearLoadedPlugins } from "../../apps/api/src/plugin-host/registry";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import {
  removePluginPackage,
  writePluginPackage,
} from "./helpers/plugin-package";

vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

const PLUGIN_ID = "kaneo-plugin-integration";

const SERVER = `
const events = (globalThis.__kaneoPluginEvents ??= []);
export default {
  kind: "kaneo-server",
  apiVersion: 1,
  settings: {
    doneStatus: { type: "text", label: "Done status", default: "done" },
    token: { type: "secret", label: "Token" },
    mode: {
      type: "select",
      label: "Mode",
      options: [{ value: "fast", label: "Fast" }, { value: "slow", label: "Slow" }],
    },
  },
  setup(kaneo) {
    kaneo.routes.put(
      "/tasks/:taskId/progress",
      kaneo.guard.task("taskId", { task: ["update"] }),
      async (c) => {
        const { value } = await c.req.json();
        await kaneo.storage(c.get("workspaceId")).set("task:" + c.req.param("taskId"), value);
        return c.json({ value, workspaceId: c.get("workspaceId") });
      },
    );
    kaneo.routes.get("/workspaces/:workspaceId/entries", kaneo.guard.workspace(), async (c) =>
      c.json(await kaneo.storage(c.get("workspaceId")).list({ prefix: c.req.query("prefix") })),
    );
    kaneo.routes.get("/workspaces/:workspaceId/settings", kaneo.guard.workspace(), async (c) =>
      c.json(await kaneo.settings(c.get("workspaceId"))),
    );
    kaneo.routes.get("/projects/:projectId/ping", kaneo.guard.project(), (c) =>
      c.json({ workspaceId: c.get("workspaceId") }),
    );
    kaneo.routes.get("/storage/:workspaceId/:key", async (c) =>
      c.json({ value: (await kaneo.storage(c.req.param("workspaceId")).get(c.req.param("key"))) ?? null }),
    );
    kaneo.webhooks.post("/hook", async (c) => c.json({ received: await c.req.json() }));
    kaneo.on("task.status_changed", (event) => {
      events.push(event);
    });
  },
};
`;

const OFFICIAL_ID = "kaneo-official-integration";

const OFFICIAL_SERVER = `
const events = (globalThis.__kaneoOfficialEvents ??= []);
export default {
  kind: "kaneo-server",
  apiVersion: 1,
  settings: {
    label: { type: "text", label: "Label", default: "Timeline" },
  },
  setup(kaneo) {
    kaneo.routes.get("/workspaces/:workspaceId/ping", kaneo.guard.workspace(), (c) =>
      c.json({ workspaceId: c.get("workspaceId") }),
    );
    kaneo.routes.get("/enabled-workspaces", async (c) =>
      c.json(await kaneo.enabledWorkspaces()),
    );
    kaneo.on("task.status_changed", (event) => {
      events.push(event.workspaceId);
    });
  },
};
`;

type Events = {
  __kaneoPluginEvents?: unknown[];
  __kaneoOfficialEvents?: string[];
};
const receivedEvents = () =>
  ((globalThis as Events).__kaneoPluginEvents ??= []);
const officialEvents = () =>
  ((globalThis as Events).__kaneoOfficialEvents ??= []);

const pluginDirs: string[] = [];

beforeAll(async () => {
  const official = await writePluginPackage(OFFICIAL_ID, OFFICIAL_SERVER);
  const thirdParty = await writePluginPackage(PLUGIN_ID, SERVER);
  pluginDirs.push(official.dir, thirdParty.dir);
  await loadPlugins([official.descriptor, thirdParty.descriptor], {
    configPath: "/kaneo/kaneo.config.ts",
    kaneoVersion: "2.29.3",
    official: new Set([official.descriptor]),
  });
  startPluginEventBridge();
});

afterAll(async () => {
  stopPluginJobs();
  clearLoadedPlugins();
  await Promise.all(pluginDirs.map(removePluginPackage));
});

beforeEach(async () => {
  await resetTestDatabase();
  receivedEvents().length = 0;
  officialEvents().length = 0;
});

async function workspaceWithAdmin() {
  const owner = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Plugin task",
      status: "to-do",
      number: 1,
    })
    .returning();
  return { ...owner, project, task: task! };
}

async function addMember(workspaceId: string, role: string) {
  const other = await createWorkspaceMember({ role });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: other.user.id,
    role,
    joinedAt: new Date(),
  });
  return other.user;
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("plugin host API", () => {
  it("lists installed plugins with web paths and workspace state", async () => {
    const { user, workspace } = await workspaceWithAdmin();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const list = await app.request("/api/plugins");
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({
      plugins: [
        expect.objectContaining({ id: OFFICIAL_ID, official: true }),
        expect.objectContaining({
          id: PLUGIN_ID,
          packageName: PLUGIN_ID,
          version: "1.0.0",
          official: false,
          web: {
            entry: `/plugins/${PLUGIN_ID}/assets/index.js?v=1.0.0`,
            styles: null,
          },
          workspace: null,
        }),
      ],
    });

    const scoped = await app.request(
      `/api/plugins?workspaceId=${workspace.id}`,
    );
    const { plugins } = await scoped.json();
    expect(plugins[0].workspace).toEqual({
      enabled: true,
      settings: { label: "Timeline" },
      configuredSecrets: [],
    });
    expect(plugins[1].workspace).toEqual({
      enabled: false,
      settings: { doneStatus: "done" },
      configuredSecrets: [],
    });
  });

  it("refuses workspace state to non-members", async () => {
    const { workspace } = await workspaceWithAdmin();
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/plugins?workspaceId=${workspace.id}`,
    );
    expect(response.status).toBe(403);
  });

  it("enables a plugin, validates settings and keeps secrets write-only", async () => {
    const { user, workspace } = await workspaceWithAdmin();
    mockAuthenticatedSession(user);
    const { app } = createApp();
    const url = `/api/plugins/${PLUGIN_ID}/workspace/${workspace.id}`;

    const invalid = await app.request(
      url,
      json("PUT", { settings: { mode: "warp", doneStatus: 3 } }),
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      message: "Some settings are invalid",
      errors: {
        mode: "Choose one of the listed options",
        doneStatus: "Must be text",
      },
    });

    const saved = await app.request(
      url,
      json("PUT", {
        enabled: true,
        settings: { doneStatus: "shipped", token: "s3cret", mode: "fast" },
      }),
    );
    expect(saved.status).toBe(200);
    const savedBody = await saved.text();
    expect(savedBody).not.toContain("s3cret");
    expect(JSON.parse(savedBody)).toEqual({
      enabled: true,
      settings: { doneStatus: "shipped", mode: "fast" },
      configuredSecrets: ["token"],
    });

    const kept = await app.request(
      url,
      json("PUT", { settings: { doneStatus: "done", mode: "slow" } }),
    );
    expect(await kept.json()).toEqual({
      enabled: true,
      settings: { doneStatus: "done", mode: "slow" },
      configuredSecrets: ["token"],
    });

    const pluginSettings = await app.request(
      `/api/plugins/${PLUGIN_ID}/workspaces/${workspace.id}/settings`,
    );
    expect(await pluginSettings.json()).toEqual({
      doneStatus: "done",
      token: "s3cret",
      mode: "slow",
    });

    const disabled = await app.request(url, json("PUT", { enabled: false }));
    expect(await disabled.json()).toMatchObject({
      enabled: false,
      settings: { doneStatus: "done", mode: "slow" },
    });

    const unknown = await app.request(
      `/api/plugins/missing/workspace/${workspace.id}`,
      json("PUT", { enabled: true }),
    );
    expect(unknown.status).toBe(404);
  });

  it("requires workspace:manage_settings to change a plugin", async () => {
    const { workspace } = await workspaceWithAdmin();
    const member = await addMember(workspace.id, "member");
    mockAuthenticatedSession(member);
    const { app } = createApp();

    const response = await app.request(
      `/api/plugins/${PLUGIN_ID}/workspace/${workspace.id}`,
      json("PUT", { enabled: true }),
    );
    expect(response.status).toBe(403);
  });

  it("guards plugin routes by membership, permissions and enablement", async () => {
    const { user, workspace, project, task } = await workspaceWithAdmin();
    const viewer = await addMember(workspace.id, "viewer");
    const outsider = await createWorkspaceMember();
    const { app } = createApp();
    const progress = `/api/plugins/${PLUGIN_ID}/tasks/${task.id}/progress`;

    mockAuthenticatedSession(user);
    const disabled = await app.request(progress, json("PUT", { value: 40 }));
    expect(disabled.status).toBe(404);
    expect(await disabled.json()).toEqual({
      message: "This plugin is not enabled in this workspace",
    });

    await app.request(
      `/api/plugins/${PLUGIN_ID}/workspace/${workspace.id}`,
      json("PUT", { enabled: true }),
    );

    const allowed = await app.request(progress, json("PUT", { value: 40 }));
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({
      value: 40,
      workspaceId: workspace.id,
    });

    const ping = await app.request(
      `/api/plugins/${PLUGIN_ID}/projects/${project.id}/ping`,
    );
    expect(await ping.json()).toEqual({ workspaceId: workspace.id });

    const missingTask = await app.request(
      `/api/plugins/${PLUGIN_ID}/tasks/missing/progress?workspaceId=${workspace.id}`,
      json("PUT", { value: 1 }),
    );
    expect(missingTask.status).toBe(400);

    mockAuthenticatedSession(viewer);
    const forbidden = await app.request(progress, json("PUT", { value: 50 }));
    expect(forbidden.status).toBe(403);

    mockAuthenticatedSession(outsider.user);
    const outside = await app.request(progress, json("PUT", { value: 60 }));
    expect(outside.status).toBe(403);

    mockAnonymousSession();
    const anonymous = await app.request(progress, json("PUT", { value: 70 }));
    expect(anonymous.status).toBe(401);
  });

  it("scopes storage to the plugin and the workspace", async () => {
    const first = await workspaceWithAdmin();
    const second = await workspaceWithAdmin();
    const { app } = createApp();

    for (const { user, workspace, task } of [first, second]) {
      mockAuthenticatedSession(user);
      await app.request(
        `/api/plugins/${PLUGIN_ID}/workspace/${workspace.id}`,
        json("PUT", { enabled: true }),
      );
      await app.request(
        `/api/plugins/${PLUGIN_ID}/tasks/${task.id}/progress`,
        json("PUT", { value: workspace.id === first.workspace.id ? 10 : 20 }),
      );
    }
    await db.insert(schema.pluginStorageTable).values([
      {
        pluginId: "other-plugin",
        workspaceId: first.workspace.id,
        key: "task:x",
        value: 1,
      },
      {
        pluginId: PLUGIN_ID,
        workspaceId: first.workspace.id,
        key: "task_%",
        value: "123",
      },
      {
        pluginId: PLUGIN_ID,
        workspaceId: first.workspace.id,
        key: "taskXY",
        value: true,
      },
    ]);

    mockAuthenticatedSession(first.user);
    const entries = await app.request(
      `/api/plugins/${PLUGIN_ID}/workspaces/${first.workspace.id}/entries?prefix=task:`,
    );
    expect(
      (await entries.json()).map((entry: { key: string; value: unknown }) => [
        entry.key,
        entry.value,
      ]),
    ).toEqual([[`task:${first.task.id}`, 10]]);

    const literal = await app.request(
      `/api/plugins/${PLUGIN_ID}/workspaces/${first.workspace.id}/entries?prefix=${encodeURIComponent("task_%")}`,
    );
    expect(await literal.json()).toEqual([
      expect.objectContaining({ key: "task_%", value: "123" }),
    ]);

    const stored = await app.request(
      `/api/plugins/${PLUGIN_ID}/storage/${second.workspace.id}/${encodeURIComponent(`task:${second.task.id}`)}`,
    );
    expect(await stored.json()).toEqual({ value: 20 });

    await db
      .delete(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, first.workspace.id));
    const remaining = await db
      .select({ workspaceId: schema.pluginStorageTable.workspaceId })
      .from(schema.pluginStorageTable);
    expect(remaining).toEqual([{ workspaceId: second.workspace.id }]);
    const plugins = await db
      .select({ workspaceId: schema.workspacePluginTable.workspaceId })
      .from(schema.workspacePluginTable);
    expect(plugins).toEqual([{ workspaceId: second.workspace.id }]);
  });

  it("delivers events only to workspaces that enabled the plugin", async () => {
    const enabled = await workspaceWithAdmin();
    const disabled = await workspaceWithAdmin();
    const { app } = createApp();
    mockAuthenticatedSession(enabled.user);
    await app.request(
      `/api/plugins/${PLUGIN_ID}/workspace/${enabled.workspace.id}`,
      json("PUT", { enabled: true }),
    );

    for (const { project, task, user } of [disabled, enabled]) {
      await publishEvent(
        "task.status_changed",
        {
          taskId: task.id,
          projectId: project.id,
          userId: user.id,
          oldStatus: "to-do",
          newStatus: "done",
          title: task.title,
        },
        { waitForHandlers: true },
      );
    }

    expect(receivedEvents()).toEqual([
      {
        type: "task.status_changed",
        workspaceId: enabled.workspace.id,
        projectId: enabled.project.id,
        taskId: enabled.task.id,
        actorId: enabled.user.id,
        from: "to-do",
        to: "done",
      },
    ]);
  });

  it("bridges a real status change made through the API", async () => {
    const { user, workspace, project, task } = await workspaceWithAdmin();
    mockAuthenticatedSession(user);
    const { app } = createApp();
    await app.request(
      `/api/plugins/${PLUGIN_ID}/workspace/${workspace.id}`,
      json("PUT", { enabled: true }),
    );

    const response = await app.request(
      `/api/task/status/${task.id}`,
      json("PUT", { status: "done" }),
    );
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(receivedEvents()).toHaveLength(1));
    expect(receivedEvents()[0]).toMatchObject({
      type: "task.status_changed",
      workspaceId: workspace.id,
      projectId: project.id,
      taskId: task.id,
      actorId: user.id,
      from: "to-do",
      to: "done",
    });
  });

  it("serves assets and webhooks without authentication", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const asset = await app.request(
      `/api/plugins/${PLUGIN_ID}/assets/index.js?v=1.0.0`,
    );
    expect(asset.status).toBe(200);
    expect(asset.headers.get("Content-Type")).toBe(
      "text/javascript; charset=utf-8",
    );

    const missing = await app.request(
      `/api/plugins/${PLUGIN_ID}/assets/server.js`,
    );
    expect(missing.status).toBe(404);

    const webhook = await app.request(
      `/api/plugins/${PLUGIN_ID}/webhooks/hook`,
      json("POST", { ping: 1 }),
    );
    expect(webhook.status).toBe(200);
    expect(await webhook.json()).toEqual({ received: { ping: 1 } });

    const route = await app.request(
      `/api/plugins/${PLUGIN_ID}/workspaces/x/settings`,
    );
    expect(route.status).toBe(401);
  });
});

describe("official plugins", () => {
  async function publishStatusChange(
    fixture: Awaited<ReturnType<typeof workspaceWithAdmin>>,
  ) {
    await publishEvent(
      "task.status_changed",
      {
        taskId: fixture.task.id,
        projectId: fixture.project.id,
        userId: fixture.user.id,
        oldStatus: "to-do",
        newStatus: "done",
        title: fixture.task.title,
      },
      { waitForHandlers: true },
    );
  }

  it("is on in workspaces that never changed it", async () => {
    const first = await workspaceWithAdmin();
    const second = await workspaceWithAdmin();
    mockAuthenticatedSession(first.user);
    const { app } = createApp();

    const ping = await app.request(
      `/api/plugins/${OFFICIAL_ID}/workspaces/${first.workspace.id}/ping`,
    );
    expect(ping.status).toBe(200);
    expect(await ping.json()).toEqual({ workspaceId: first.workspace.id });

    const enabled = await app.request(
      `/api/plugins/${OFFICIAL_ID}/enabled-workspaces`,
    );
    expect(await enabled.json()).toEqual(
      [first.workspace.id, second.workspace.id].sort(),
    );

    await publishStatusChange(first);
    expect(officialEvents()).toEqual([first.workspace.id]);
    expect(receivedEvents()).toEqual([]);
    expect(await db.select().from(schema.workspacePluginTable)).toEqual([]);
  });

  it("keeps an official plugin on when only its settings change", async () => {
    const { user, workspace } = await workspaceWithAdmin();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const saved = await app.request(
      `/api/plugins/${OFFICIAL_ID}/workspace/${workspace.id}`,
      json("PUT", { settings: { label: "Roadmap" } }),
    );
    expect(await saved.json()).toEqual({
      enabled: true,
      settings: { label: "Roadmap" },
      configuredSecrets: [],
    });
  });

  it("lets a workspace admin turn an official plugin off and on again", async () => {
    const off = await workspaceWithAdmin();
    const on = await workspaceWithAdmin();
    mockAuthenticatedSession(off.user);
    const { app } = createApp();
    const url = `/api/plugins/${OFFICIAL_ID}/workspace/${off.workspace.id}`;

    const disabled = await app.request(url, json("PUT", { enabled: false }));
    expect(disabled.status).toBe(200);
    expect(await disabled.json()).toMatchObject({ enabled: false });
    expect(
      await db
        .select({
          workspaceId: schema.workspacePluginTable.workspaceId,
          enabled: schema.workspacePluginTable.enabled,
        })
        .from(schema.workspacePluginTable),
    ).toEqual([{ workspaceId: off.workspace.id, enabled: false }]);

    const listed = await app.request(
      `/api/plugins?workspaceId=${off.workspace.id}`,
    );
    expect((await listed.json()).plugins[0]).toMatchObject({
      id: OFFICIAL_ID,
      official: true,
      workspace: { enabled: false },
    });

    const ping = await app.request(
      `/api/plugins/${OFFICIAL_ID}/workspaces/${off.workspace.id}/ping`,
    );
    expect(ping.status).toBe(404);

    const enabled = await app.request(
      `/api/plugins/${OFFICIAL_ID}/enabled-workspaces`,
    );
    expect(await enabled.json()).toEqual([on.workspace.id]);

    await publishStatusChange(off);
    await publishStatusChange(on);
    expect(officialEvents()).toEqual([on.workspace.id]);

    const reenabled = await app.request(url, json("PUT", { enabled: true }));
    expect(await reenabled.json()).toMatchObject({ enabled: true });
    const pingAgain = await app.request(
      `/api/plugins/${OFFICIAL_ID}/workspaces/${off.workspace.id}/ping`,
    );
    expect(pingAgain.status).toBe(200);
  });
});
