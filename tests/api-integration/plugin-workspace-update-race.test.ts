import { and, eq } from "drizzle-orm";
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
import { createApp } from "../../apps/api/src/index";
import { getWorkspacePlugin } from "../../apps/api/src/plugin-host/data/workspace-plugins";
import { loadPlugins } from "../../apps/api/src/plugin-host/loader/load-plugins";
import { clearLoadedPlugins } from "../../apps/api/src/plugin-host/registry";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  removePluginPackage,
  writePluginPackage,
} from "./helpers/plugin-package";

type WorkspacePluginsModule =
  typeof import("../../apps/api/src/plugin-host/data/workspace-plugins");

const actual = vi.hoisted(() => ({
  getWorkspacePlugin: null as
    | WorkspacePluginsModule["getWorkspacePlugin"]
    | null,
}));

vi.mock(
  "../../apps/api/src/plugin-host/data/workspace-plugins",
  async (importOriginal) => {
    const original = await importOriginal<WorkspacePluginsModule>();
    actual.getWorkspacePlugin = original.getWorkspacePlugin;
    return {
      ...original,
      getWorkspacePlugin: vi.fn(original.getWorkspacePlugin),
    };
  },
);

const PLUGIN_ID = "kaneo-plugin-concurrent-update";

const SERVER = `
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
  setup() {},
};
`;

const ENABLE = { enabled: true };
const SETTINGS = {
  settings: { doneStatus: "shipped", token: "s3cret", mode: "fast" },
};

let pluginDir: string | undefined;

beforeAll(async () => {
  const { dir, descriptor } = await writePluginPackage(PLUGIN_ID, SERVER);
  pluginDir = dir;
  await loadPlugins([descriptor], {
    configPath: "/kaneo/kaneo.config.ts",
    kaneoVersion: "2.29.3",
    official: new Set(),
  });
});

afterAll(async () => {
  clearLoadedPlugins();
  if (pluginDir) {
    await removePluginPackage(pluginDir);
  }
});

beforeEach(async () => {
  await resetTestDatabase();
});

function json(body: unknown): RequestInit {
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function holdNextRead() {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markRead!: () => void;
  const read = new Promise<void>((resolve) => {
    markRead = resolve;
  });
  vi.mocked(getWorkspacePlugin).mockImplementationOnce(
    async (pluginId, workspaceId) => {
      const row = await actual.getWorkspacePlugin!(pluginId, workspaceId);
      markRead();
      await released;
      return row;
    },
  );
  return { read, release };
}

async function storedRow(workspaceId: string) {
  return db
    .select({
      enabled: schema.workspacePluginTable.enabled,
      settings: schema.workspacePluginTable.settings,
    })
    .from(schema.workspacePluginTable)
    .where(
      and(
        eq(schema.workspacePluginTable.workspaceId, workspaceId),
        eq(schema.workspacePluginTable.pluginId, PLUGIN_ID),
      ),
    );
}

describe("overlapping workspace plugin updates", () => {
  it.each(
    [
      { order: "enable, then settings", stale: ENABLE, fresh: SETTINGS },
      { order: "settings, then enable", stale: SETTINGS, fresh: ENABLE },
    ].flatMap((race) =>
      [false, true].map((existing) => ({ ...race, existing })),
    ),
  )(
    "keeps both changes when they read in the order $order (existing row: $existing)",
    async ({ stale, fresh, existing }) => {
      const { user, workspace } = await createWorkspaceMember({
        role: "admin",
      });
      if (existing) {
        await db.insert(schema.workspacePluginTable).values({
          workspaceId: workspace.id,
          pluginId: PLUGIN_ID,
          enabled: false,
          settings: { doneStatus: "draft" },
        });
      }
      mockAuthenticatedSession(user);
      const { app } = createApp();
      const url = `/api/plugins/${PLUGIN_ID}/workspace/${workspace.id}`;

      const held = holdNextRead();
      const slow = app.request(url, json(stale));
      await held.read;
      const quick = await app.request(url, json(fresh));
      expect(quick.status).toBe(200);
      held.release();
      const late = await slow;

      expect(late.status).toBe(200);
      expect(await late.json()).toEqual({
        enabled: true,
        settings: { doneStatus: "shipped", mode: "fast" },
        configuredSecrets: ["token"],
      });
      expect(await storedRow(workspace.id)).toEqual([
        {
          enabled: true,
          settings: { doneStatus: "shipped", token: "s3cret", mode: "fast" },
        },
      ]);
    },
  );
});
