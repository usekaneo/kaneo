import type { Kaneo } from "./context.js";
import { progressBody } from "./progress-body.js";
import { progressKey, projectPrefix } from "./progress-key.js";

const MAX_TASKS = 1000;

export function registerRoutes(kaneo: Kaneo) {
  kaneo.routes.get(
    "/projects/:projectId/progress",
    kaneo.guard.project("projectId", { task: ["read"] }),
    async (c) => {
      const prefix = projectPrefix(c.req.param("projectId"));
      const entries = await kaneo
        .storage(c.get("workspaceId"))
        .list<number>({ prefix, limit: MAX_TASKS });
      const progress = Object.fromEntries(
        entries.map((entry) => [entry.key.slice(prefix.length), entry.value]),
      );
      return c.json({ progress });
    },
  );

  kaneo.routes.get(
    "/projects/:projectId/tasks/:taskId/progress",
    kaneo.guard.task("taskId", { task: ["read"] }),
    async (c) => {
      const key = progressKey(c.req.param("projectId"), c.req.param("taskId"));
      const value = await kaneo.storage(c.get("workspaceId")).get<number>(key);
      return c.json({ value: value ?? 0 });
    },
  );

  kaneo.routes.put(
    "/projects/:projectId/tasks/:taskId/progress",
    kaneo.guard.task("taskId", { task: ["update"] }),
    async (c) => {
      const body = progressBody.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json(
          { error: "value must be a whole number from 0 to 100" },
          400,
        );
      }
      const key = progressKey(c.req.param("projectId"), c.req.param("taskId"));
      await kaneo.storage(c.get("workspaceId")).set(key, body.data.value);
      return c.json({ value: body.data.value });
    },
  );
}
