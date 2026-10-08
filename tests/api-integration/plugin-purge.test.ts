import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { CliError } from "../../apps/api/src/cli/cli-error";
import {
  type PurgeDependencies,
  runPurge,
} from "../../apps/api/src/cli/commands/purge/run-purge";
import db, { schema } from "../../apps/api/src/database";
import {
  countPluginData,
  deletePluginData,
} from "../../apps/api/src/plugin-host/data/plugin-data";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  removePluginPackage,
  writePluginPackage,
} from "./helpers/plugin-package";

const REMOVED = "kaneo-plugin-removed";
const KEPT = "kaneo-plugin-kept";
const SERVER =
  "export default { kind: 'kaneo-server', apiVersion: 1, settings: {}, setup() {} };\n";

const pluginDirs: string[] = [];

function dependencies({
  interactive = false,
  answer = "",
}: { interactive?: boolean; answer?: string } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const deps: PurgeDependencies = {
    output: {
      log: (message) => out.push(message),
      error: (message) => err.push(message),
    },
    prompt: { interactive, ask: async () => answer },
    countData: countPluginData,
    deleteData: deletePluginData,
  };
  return { out, err, deps };
}

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

async function configWith(pluginId: string, extra = "") {
  const { dir, descriptor } = await writePluginPackage(pluginId, SERVER);
  pluginDirs.push(dir);
  const configPath = join(dir, "kaneo.config.mjs");
  await writeFile(
    configPath,
    `export default { ${extra} plugins: [${JSON.stringify(descriptor)}] };\n`,
  );
  return configPath;
}

beforeEach(async () => {
  await resetTestDatabase();
  await seed();
});

afterAll(async () => {
  await Promise.all(pluginDirs.map(removePluginPackage));
});

describe("kaneo plugin purge", () => {
  it("deletes only the purged plugin's rows and reports counts per table", async () => {
    const { out, deps } = dependencies();

    expect(
      await runPurge({ pluginId: REMOVED, yes: true, configPath: null }, deps),
    ).toBe(0);
    expect(out).toEqual([
      `Plugin "${REMOVED}" has 3 rows in plugin_storage and 2 rows in workspace_plugin.`,
      "Deleted 3 rows from plugin_storage.",
      "Deleted 2 rows from workspace_plugin.",
    ]);
    expect(await rowsFor(REMOVED)).toEqual({ storage: 0, workspaces: 0 });
    expect(await rowsFor(KEPT)).toEqual({ storage: 1, workspaces: 1 });
  });

  it("asks for the plugin id in a terminal and keeps data on a wrong answer", async () => {
    const wrong = dependencies({ interactive: true, answer: "yes" });
    expect(
      await runPurge(
        { pluginId: REMOVED, yes: false, configPath: null },
        wrong.deps,
      ),
    ).toBe(1);
    expect(wrong.err).toEqual(["Cancelled. Nothing was deleted."]);
    expect(await rowsFor(REMOVED)).toEqual({ storage: 3, workspaces: 2 });

    const right = dependencies({ interactive: true, answer: REMOVED });
    expect(
      await runPurge(
        { pluginId: REMOVED, yes: false, configPath: null },
        right.deps,
      ),
    ).toBe(0);
    expect(await rowsFor(REMOVED)).toEqual({ storage: 0, workspaces: 0 });
  });

  it("refuses to purge without --yes outside a terminal", async () => {
    const { deps } = dependencies();
    await expect(
      runPurge({ pluginId: REMOVED, yes: false, configPath: null }, deps),
    ).rejects.toThrow(`Run kaneo plugin purge ${REMOVED} --yes`);
    expect(await rowsFor(REMOVED)).toEqual({ storage: 3, workspaces: 2 });
  });

  it("refuses a plugin that is still in the config", async () => {
    const configPath = await configWith(REMOVED);
    const { deps } = dependencies();

    await expect(
      runPurge({ pluginId: REMOVED, yes: true, configPath }, deps),
    ).rejects.toThrow(
      `Plugin "${REMOVED}" is still installed. Remove it from kaneo.config.mjs`,
    );
    expect(await rowsFor(REMOVED)).toEqual({ storage: 3, workspaces: 2 });
  });

  it("refuses a built-in plugin until the config turns it off", async () => {
    await db.insert(schema.workspacePluginTable).values({
      workspaceId: (await createWorkspaceMember()).workspace.id,
      pluginId: "gantt",
      enabled: false,
    });
    const refused = dependencies();
    await expect(
      runPurge(
        { pluginId: "gantt", yes: true, configPath: null },
        refused.deps,
      ),
    ).rejects.toThrow(CliError);
    expect(await rowsFor("gantt")).toEqual({ storage: 0, workspaces: 1 });

    const configPath = await configWith(KEPT, "official: { gantt: false },");
    const allowed = dependencies();
    expect(
      await runPurge(
        { pluginId: "gantt", yes: true, configPath },
        allowed.deps,
      ),
    ).toBe(0);
    expect(await rowsFor("gantt")).toEqual({ storage: 0, workspaces: 0 });
  });

  it("does nothing when the plugin has no data", async () => {
    const { out, deps } = dependencies();
    expect(
      await runPurge(
        { pluginId: "kaneo-plugin-never", yes: false, configPath: null },
        deps,
      ),
    ).toBe(0);
    expect(out).toEqual([
      'Plugin "kaneo-plugin-never" has no stored data. Nothing to delete.',
    ]);
  });

  it("rejects values that cannot be plugin ids", async () => {
    const { deps } = dependencies();
    await expect(
      runPurge({ pluginId: "Not An Id", yes: true, configPath: null }, deps),
    ).rejects.toThrow("is not a plugin id");
  });
});
