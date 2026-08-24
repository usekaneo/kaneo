import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";

type Operation = {
  operationId?: string;
  summary?: string;
  responses: Record<string, unknown>;
  security?: unknown[];
};
type Spec = {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
  security?: Array<Record<string, unknown>>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, { type: string; scheme?: string }>;
  };
};

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

function operations(spec: Spec): Array<[string, string, Operation]> {
  const out: Array<[string, string, Operation]> = [];
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (HTTP_METHODS.includes(method)) out.push([method, path, operation]);
    }
  }
  return out;
}

let spec: Spec;

beforeAll(async () => {
  const { app } = createApp();
  const response = await app.request("/api/openapi");
  expect(response.status).toBe(200);
  spec = (await response.json()) as Spec;
});

describe("Kaneo API OpenAPI spec", () => {
  it("is a valid OpenAPI 3.1 document", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Kaneo API");
  });

  it("requires bearer auth globally", () => {
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(spec.security).toContainEqual({ bearerAuth: [] });
  });

  it("documents the routes the clients depend on", () => {
    const keys = new Set(
      operations(spec).map(
        ([method, path]) => `${method.toUpperCase()} ${path}`,
      ),
    );
    for (const op of [
      "GET /config",
      "GET /label/{id}",
      "POST /label",
      "GET /project",
      "GET /task/tasks/{projectId}",
      "PATCH /task/bulk",
      "GET /search",
      "GET /notification",
      "POST /auth/organization/create",
    ]) {
      expect(keys.has(op), `missing operation ${op}`).toBe(true);
    }
  });

  it("gives every operation a unique operationId and a summary", () => {
    const ids: string[] = [];
    for (const [method, path, operation] of operations(spec)) {
      expect(
        operation.operationId,
        `${method} ${path} has no operationId`,
      ).toBeTruthy();
      expect(
        operation.summary,
        `${method} ${path} has no summary`,
      ).toBeTruthy();
      ids.push(operation.operationId as string);
    }
    expect(new Set(ids).size, "operationIds must be unique").toBe(ids.length);
  });

  it("names its entity schemas as reusable components", () => {
    expect(Object.keys(spec.components.schemas)).toEqual(
      expect.arrayContaining([
        "Task",
        "Project",
        "Label",
        "Column",
        "Comment",
        "Activity",
        "TimeEntry",
        "Notification",
        "Config",
        "SearchResult",
        "WorkspaceMember",
      ]),
    );
  });

  it("documents a 401 on every operation that requires auth", () => {
    const missing: string[] = [];
    for (const [method, path, operation] of operations(spec)) {
      const isPublic =
        Array.isArray(operation.security) && operation.security.length === 0;
      if (isPublic) continue;
      if (!operation.responses["401"])
        missing.push(`${method.toUpperCase()} ${path}`);
    }
    expect(missing).toEqual([]);
  });
});
