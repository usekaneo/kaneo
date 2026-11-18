import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { state } = vi.hoisted(() => ({
  state: {
    lookedUpIds: [] as string[],
    assertedProjectIds: [] as (string[] | undefined)[],
  },
}));

// RFC 0001 WP1: integration -> project -> workspace resolution table.
// Rows carry both the workspace (for validateWorkspaceAccess) and the project
// (for assertProjectAccess) the integration belongs to.
const SCOPE_BY_INTEGRATION: Record<
  string,
  { workspaceId: string; projectId: string } | undefined
> = {
  "integration-mine": {
    workspaceId: "workspace-mine",
    projectId: "project-mine",
  },
  "integration-theirs": {
    workspaceId: "workspace-theirs",
    projectId: "project-theirs",
  },
};

vi.mock("../../../apps/api/src/database", async () => {
  const schema = await import("../../../apps/api/src/database/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");

  const dialect = new PgDialect();
  let boundId: string | undefined;

  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const [id] = dialect.sqlToQuery(condition).params;
      boundId = typeof id === "string" ? id : undefined;
      return chain;
    },
    limit: async () => {
      if (!boundId) return [];
      state.lookedUpIds.push(boundId);
      const scope = SCOPE_BY_INTEGRATION[boundId];
      return scope ? [scope] : [];
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

vi.mock(
  "../../../apps/api/src/project-access/assert-project-access",
  async () => {
    const { HTTPException } = await import("hono/http-exception");
    return {
      assertProjectAccess: async (_userId: string, projectIds: string[]) => {
        state.assertedProjectIds.push(projectIds);
        if (projectIds.includes("project-theirs")) {
          throw new HTTPException(403, { message: "No project access" });
        }
      },
    };
  },
);

const { workspaceAccess } =
  await import("../../../apps/api/src/utils/workspace-access-middleware");

// Mirrors the RFC 0001 id-keyed routes: the integrationId travels in the path
// param, or in the JSON body when the route has no param.
function buildApp() {
  return new Hono()
    .use("*", async (c, next) => {
      c.set("userId", "user-1");
      return next();
    })
    .delete(
      "/integration/:integrationId",
      workspaceAccess.fromIntegration(),
      async (c) => {
        return c.json({ actedOn: c.req.param("integrationId") });
      },
    )
    .post("/sync", workspaceAccess.fromIntegration(), async (c) => {
      const body = (await c.req.json()) as { integrationId: string };
      return c.json({ actedOn: body.integrationId });
    });
}

describe("workspaceAccess.fromIntegration", () => {
  beforeEach(() => {
    state.lookedUpIds.length = 0;
    state.assertedProjectIds.length = 0;
  });

  it("authorizes a param id and asserts the integration's project", async () => {
    const res = await buildApp().request("/integration/integration-mine", {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(state.lookedUpIds).toEqual(["integration-mine"]);
    expect(state.assertedProjectIds).toEqual([["project-mine"]]);
  });

  it("rejects an integration of a foreign workspace with 403", async () => {
    const res = await buildApp().request("/integration/integration-theirs", {
      method: "DELETE",
    });

    expect(res.status).toBe(403);
    expect(state.lookedUpIds).toEqual(["integration-theirs"]);
  });

  it("returns 404 for a non-existent integration id", async () => {
    const res = await buildApp().request("/integration/integration-unknown", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  it("reads the id from the JSON body on body routes", async () => {
    const res = await buildApp().request("/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrationId: "integration-mine" }),
    });

    expect(res.status).toBe(200);
    expect(state.lookedUpIds).toEqual(["integration-mine"]);
  });

  it("never authorizes against a query-string id", async () => {
    const res = await buildApp().request(
      "/sync?integrationId=integration-mine",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId: "integration-theirs" }),
      },
    );

    expect(state.lookedUpIds).toEqual(["integration-theirs"]);
    expect(res.status).toBe(403);
  });
});
