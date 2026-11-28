import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { stopPluginJobs } from "../../apps/api/src/plugin-host/context/plugin-jobs";
import { loadPlugins } from "../../apps/api/src/plugin-host/loader/load-plugins";
import { clearLoadedPlugins } from "../../apps/api/src/plugin-host/registry";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  removePluginPackage,
  writePluginPackage,
} from "./helpers/plugin-package";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

const REMOVED = "kaneo-plugin-removed";
const KEPT = "kaneo-plugin-kept";
const SERVER =
  "export default { kind: 'kaneo-server', apiVersion: 1, settings: {}, setup() {} };\n";

const pluginDirs: string[] = [];

async function seed() {
  const first = await createWorkspaceMember();
  const second = await createWorkspaceMember();
  const workspaces = [first.workspace.id, second.workspace.id];
  await db.insert(schema.workspacePluginTable).values([
    ...workspaces.map((workspaceId) => ({
      workspaceId,
      pluginId: REMOVED,
      enabled: true,
    })),
    { workspaceId: first.workspace.id, pluginId: KEPT, enabled: true },
  ]);
  await db.insert(schema.pluginStorageTable).values([
    { workspaceId: first.workspace.id, pluginId: REMOVED, key: "a", value: 1 },
    { workspaceId: first.workspace.id, pluginId: REMOVED, key: "b", value: 2 },
    { workspaceId: second.workspace.id, pluginId: REMOVED, key: "a", value: 3 },
    { workspaceId: first.workspace.id, pluginId: KEPT, key: "a", value: 4 },
  ]);
  return first;
}

async function rowsFor(pluginId: string) {
  const storage = await db
    .select()
    .from(schema.pluginStorageTable)
    .where(eq(schema.pluginStorageTable.pluginId, pluginId));
  const settings = await db
    .select()
    .from(schema.workspacePluginTable)
    .where(eq(schema.workspacePluginTable.pluginId, pluginId));
  return { storage: storage.length, workspaces: settings.length };
}

async function install(pluginId: string, official: boolean) {
  const { dir, descriptor } = await writePluginPackage(pluginId, SERVER);
  pluginDirs.push(dir);
  await loadPlugins([descriptor], {
    configPath: "/kaneo/kaneo.config.ts",
    kaneoVersion: "2.29.3",
    official: new Set(official ? [descriptor] : []),
  });
}

async function purgeAsAdmin(pluginId: string) {
  mockAuthenticatedSession(await createInstanceAdmin());
  return projectAccessApi()(`/plugins/${pluginId}/data`, {
    method: "DELETE",
  });
}

async function auditEntries() {
  return db
    .select({
      action: schema.adminAuditLogTable.action,
      targetType: schema.adminAuditLogTable.targetType,
      targetId: schema.adminAuditLogTable.targetId,
      metadata: schema.adminAuditLogTable.metadata,
    })
    .from(schema.adminAuditLogTable);
}

beforeEach(async () => {
  vi.stubEnv("KANEO_CONFIG", "");
  vi.stubEnv("DISABLE_PLUGINS", "");
  await resetTestDatabase();
});

afterEach(() => {
  stopPluginJobs();
  clearLoadedPlugins();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await Promise.all(pluginDirs.map(removePluginPackage));
});

describe("DELETE /api/plugins/{pluginId}/data", () => {
  it("deletes only the purged plugin's rows and reports counts per table", async () => {
    await seed();

    const response = await purgeAsAdmin(REMOVED);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ storage: 3, workspaces: 2 });
    expect(await rowsFor(REMOVED)).toEqual({ storage: 0, workspaces: 0 });
    expect(await rowsFor(KEPT)).toEqual({ storage: 1, workspaces: 1 });
    expect(await auditEntries()).toEqual([
      {
        action: "instance.plugin_data_purged",
        targetType: "plugin",
        targetId: REMOVED,
        metadata: { storage: 3, workspaces: 2 },
      },
    ]);
  });

  it("reports zero rows when the plugin has no data", async () => {
    const response = await purgeAsAdmin("kaneo-plugin-never");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ storage: 0, workspaces: 0 });
  });

  it("refuses a plugin that is still installed", async () => {
    await seed();
    await install(REMOVED, false);

    const response = await purgeAsAdmin(REMOVED);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: `Plugin "${REMOVED}" is still installed. Remove it from kaneo.config.ts and restart Kaneo, then purge its data.`,
    });
    expect(await rowsFor(REMOVED)).toEqual({ storage: 3, workspaces: 2 });
  });

  it("refuses a built-in plugin until the config turns it off", async () => {
    const { workspace } = await seed();
    await db.insert(schema.workspacePluginTable).values({
      workspaceId: workspace.id,
      pluginId: "gantt-integration",
      enabled: false,
    });
    await install("gantt-integration", true);

    const refused = await purgeAsAdmin("gantt-integration");
    expect(refused.status).toBe(409);
    expect((await refused.json()).message).toContain(
      "official: { gantt-integration: false }",
    );
    expect(await rowsFor("gantt-integration")).toEqual({
      storage: 0,
      workspaces: 1,
    });

    clearLoadedPlugins();
    const allowed = await purgeAsAdmin("gantt-integration");
    expect(allowed.status).toBe(200);
    expect(await rowsFor("gantt-integration")).toEqual({
      storage: 0,
      workspaces: 0,
    });
  });

  it("refuses while plugins are turned off, because it cannot tell what is installed", async () => {
    await seed();
    vi.stubEnv("DISABLE_PLUGINS", "true");

    const response = await purgeAsAdmin(REMOVED);

    expect(response.status).toBe(409);
    expect((await response.json()).message).toContain("DISABLE_PLUGINS=true");
    expect(await rowsFor(REMOVED)).toEqual({ storage: 3, workspaces: 2 });
  });

  it("needs the instance:settings permission", async () => {
    const member = await seed();
    mockAuthenticatedSession(member.user);

    const response = await projectAccessApi()(`/plugins/${REMOVED}/data`, {
      method: "DELETE",
    });

    expect(response.status).toBe(403);
    expect(await rowsFor(REMOVED)).toEqual({ storage: 3, workspaces: 2 });
    expect(await auditEntries()).toEqual([]);
  });

  it("rejects values that cannot be plugin ids", async () => {
    const response = await purgeAsAdmin("Not_An_Id");

    expect(response.status).toBe(400);
  });
});
