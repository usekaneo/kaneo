import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { startServerPlugin } from "../../apps/api/src/plugin-host/context/start-server-plugin";
import {
  clearLoadedPlugins,
  registerLoadedPlugin,
} from "../../apps/api/src/plugin-host/registry";
import taskProgress from "../../examples/plugins/task-progress/src/server";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);
afterEach(clearLoadedPlugins);

it("only reads and stores task progress under the task's own project", async () => {
  const id = "kaneo-plugin-task-progress";
  const plugin = {
    id,
    name: "Task Progress",
    packageName: id,
    version: "1.0.0",
    description: null,
    official: false,
    options: { autoComplete: false },
    settings: taskProgress.settings,
    web: null,
  };
  registerLoadedPlugin({
    ...plugin,
    server: await startServerPlugin(plugin, taskProgress),
  });

  const { user, workspace } = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const { project: otherProject } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Progress test task",
      status: columns.todo.slug,
    })
    .returning();
  await db.insert(schema.workspacePluginTable).values({
    pluginId: id,
    workspaceId: workspace.id,
    enabled: true,
  });

  mockAuthenticatedSession(user);
  const { app } = createApp();
  const base = `/api/plugins/${id}/projects`;
  const valid = `${base}/${project.id}/tasks/${task.id}/progress`;
  const mismatched = `${base}/${otherProject.id}/tasks/${task.id}/progress`;
  const put = (value: number): RequestInit => ({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });

  expect((await app.request(valid, put(40))).status).toBe(200);
  expect((await app.request(mismatched, put(80))).status).toBe(404);
  expect((await app.request(mismatched)).status).toBe(404);
  expect(await (await app.request(valid)).json()).toEqual({ value: 40 });
  expect(
    await (await app.request(`${base}/${otherProject.id}/progress`)).json(),
  ).toEqual({ progress: {} });
});
