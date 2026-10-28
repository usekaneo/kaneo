import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { state } = vi.hoisted(() => ({
  state: { lookedUpIds: [] as string[], validatedWorkspaces: [] as string[] },
}));

const WORKSPACE_BY_ID: Record<string, string> = {
  "task-in-my-workspace": "workspace-mine",
  "task-in-other-workspace": "workspace-theirs",
  "project-in-my-workspace": "workspace-mine",
  "project-in-other-workspace": "workspace-theirs",
};

vi.mock("../../../apps/api/src/database", async () => {
  const schema = await import("../../../apps/api/src/database/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");

  // `sqlToQuery` is the dialect method drizzle's own `.toSQL()` is built on, so
  // the bound parameters come back through a supported surface rather than by
  // reaching into the condition object's internals.
  const dialect = new PgDialect();
  let boundId: string | undefined;

  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
      // The `task` lookup filters on a single id; joins contribute no
      // parameters because they compare two columns.
      const [id] = dialect.sqlToQuery(condition).params;
      boundId = typeof id === "string" ? id : undefined;
      return chain;
    },
    limit: async () => {
      if (!boundId) {
        return [];
      }
      state.lookedUpIds.push(boundId);
      const workspaceId = WORKSPACE_BY_ID[boundId];
      return workspaceId ? [{ workspaceId }] : [];
    },
  };

  return { default: chain, schema };
});

vi.mock("../../../apps/api/src/utils/validate-workspace-access", async () => {
  const { HTTPException } = await import("hono/http-exception");
  return {
    validateWorkspaceAccess: async (
      _userId: string,
      workspaceId: string,
      _apiKeyId?: string,
      options: { notFoundMessage?: string } = {},
    ) => {
      state.validatedWorkspaces.push(workspaceId);
      if (workspaceId !== "workspace-mine") {
        throw new HTTPException(404, {
          message: options.notFoundMessage ?? "Workspace not found",
        });
      }
    },
  };
});

const { workspaceAccess } =
  await import("../../../apps/api/src/utils/workspace-access-middleware");

// Mirrors POST /api/activity/comment: there is no `taskId` path param, the id
// travels in the JSON body, and the handler acts on that body value.
function buildApp() {
  return new Hono()
    .use("*", async (c, next) => {
      c.set("userId", "user-1");
      return next();
    })
    .post("/comment", workspaceAccess.fromTaskId(), async (c) => {
      const body = (await c.req.json()) as { taskId: string };
      return c.json({ actedOn: body.taskId });
    })
    .get("/task/:id", workspaceAccess.fromTask(), async (c) =>
      c.json({ actedOn: c.req.param("id") }),
    )
    .get("/project/:id", workspaceAccess.fromProject(), async (c) =>
      c.json({ actedOn: c.req.param("id") }),
    )
    .get("/projects", workspaceAccess.fromQuery(), async (c) =>
      c.json({ ok: true }),
    );
}

function post(query: string, body: Record<string, unknown>) {
  return buildApp().request(`/comment${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function get(path: string) {
  return buildApp().request(path);
}

async function snapshot(res: Response) {
  return { status: res.status, body: await res.text() };
}

describe("workspaceAccess lookup sources", () => {
  beforeEach(() => {
    state.lookedUpIds.length = 0;
    state.validatedWorkspaces.length = 0;
  });

  it("authorizes against the body id the handler will act on", async () => {
    const res = await post("", { taskId: "task-in-my-workspace" });

    expect(res.status).toBe(200);
    expect(state.lookedUpIds).toEqual(["task-in-my-workspace"]);
  });

  it("hides a body id in a workspace the caller cannot access", async () => {
    const res = await post("", { taskId: "task-in-other-workspace" });

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Task not found");
    expect(state.lookedUpIds).toEqual(["task-in-other-workspace"]);
  });

  it("does not let a query id override the body id the handler acts on", async () => {
    const res = await post("?taskId=task-in-my-workspace", {
      taskId: "task-in-other-workspace",
    });

    expect(state.lookedUpIds).toEqual(["task-in-other-workspace"]);
    expect(res.status).toBe(404);
  });

  it("returns 404 for an unknown lookup id without falling through to the query workspace", async () => {
    const res = await post("?workspaceId=workspace-mine", {
      taskId: "task-missing",
    });

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Task not found");
    expect(state.validatedWorkspaces).toEqual([]);
  });

  it("returns 404 with the resource message for an unknown path id", async () => {
    const task = await get("/task/task-missing?workspaceId=workspace-mine");
    const project = await get("/project/project-missing");

    expect(await snapshot(task)).toEqual({
      status: 404,
      body: "Task not found",
    });
    expect(await snapshot(project)).toEqual({
      status: 404,
      body: "Project not found",
    });
    expect(state.validatedWorkspaces).toEqual([]);
  });

  it("answers a foreign task exactly like a missing one", async () => {
    const foreign = await snapshot(await get("/task/task-in-other-workspace"));
    const missing = await snapshot(await get("/task/task-missing"));

    expect(foreign).toEqual(missing);
    expect(foreign.status).toBe(404);
  });

  it("answers a foreign project exactly like a missing one", async () => {
    const foreign = await snapshot(
      await get("/project/project-in-other-workspace"),
    );
    const missing = await snapshot(await get("/project/project-missing"));

    expect(foreign).toEqual(missing);
    expect(foreign.status).toBe(404);
  });

  it("uses the workspace message for a workspace id taken from the query", async () => {
    const res = await get("/projects?workspaceId=workspace-theirs");

    expect(await snapshot(res)).toEqual({
      status: 404,
      body: "Workspace not found",
    });
  });

  it("returns 400 only when no source provides any id", async () => {
    const lookup = await post("", {});
    const query = await get("/projects");

    expect(await snapshot(lookup)).toEqual({
      status: 400,
      body: "Workspace ID could not be determined",
    });
    expect(await snapshot(query)).toEqual({
      status: 400,
      body: "Workspace ID could not be determined",
    });
    expect(state.lookedUpIds).toEqual([]);
  });
});
