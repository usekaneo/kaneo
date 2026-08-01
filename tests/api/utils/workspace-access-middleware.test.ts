import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: { lookedUpIds: [] as string[] },
}));

const WORKSPACE_BY_TASK: Record<string, string> = {
  "task-in-my-workspace": "workspace-mine",
  "task-in-other-workspace": "workspace-theirs",
};

// The `lookup` sources resolve a workspace with a single `... where(eq(id))`
// query, so reading the bound parameter back off that condition tells us which
// id the middleware actually authorized against.
function readBoundId(condition: unknown): string | undefined {
  const chunks = (condition as { queryChunks?: unknown[] })?.queryChunks ?? [];
  for (const chunk of chunks) {
    const value = (chunk as { value?: unknown })?.value;
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

vi.mock("../../../apps/api/src/database", async () => {
  const schema = await import("../../../apps/api/src/database/schema");

  let boundId: string | undefined;
  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: (condition: unknown) => {
      boundId = readBoundId(condition);
      return chain;
    },
    limit: async () => {
      if (!boundId) {
        return [];
      }
      state.lookedUpIds.push(boundId);
      const workspaceId = WORKSPACE_BY_TASK[boundId];
      return workspaceId ? [{ workspaceId }] : [];
    },
  };

  return { default: chain, schema };
});

vi.mock("../../../apps/api/src/utils/validate-workspace-access", async () => {
  const { HTTPException } = await import("hono/http-exception");
  return {
    validateWorkspaceAccess: async (_userId: string, workspaceId: string) => {
      if (workspaceId !== "workspace-mine") {
        throw new HTTPException(403, {
          message: "You don't have access to this workspace",
        });
      }
    },
  };
});

const { workspaceAccess } = await import(
  "../../../apps/api/src/utils/workspace-access-middleware"
);

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
    });
}

function post(query: string, body: Record<string, unknown>) {
  return buildApp().request(`/comment${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("workspaceAccess lookup sources", () => {
  beforeEach(() => {
    state.lookedUpIds.length = 0;
  });

  it("authorizes against the body id the handler will act on", async () => {
    const res = await post("", { taskId: "task-in-my-workspace" });

    expect(res.status).toBe(200);
    expect(state.lookedUpIds).toEqual(["task-in-my-workspace"]);
  });

  it("rejects a body id in a workspace the caller cannot access", async () => {
    const res = await post("", { taskId: "task-in-other-workspace" });

    expect(res.status).toBe(403);
  });

  it("does not let a query id override the body id the handler acts on", async () => {
    const res = await post("?taskId=task-in-my-workspace", {
      taskId: "task-in-other-workspace",
    });

    expect(state.lookedUpIds).toEqual(["task-in-other-workspace"]);
    expect(res.status).toBe(403);
  });
});
