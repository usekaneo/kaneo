import { describe, expect, it } from "vitest";
import {
  dedupeOperationIds,
  ensureOperationSummaries,
  markOptionalSchemaFieldsNullable,
  mergeOpenApiSpecs,
  normalizeApiServerUrl,
  normalizeEmptyRequiredArrays,
  normalizeNullableSchemasForOpenApi30,
  normalizeOrganizationAuthOperations,
} from "../../../apps/api/src/utils/openapi-spec";

describe("openapi spec helpers", () => {
  it("normalizes API server urls", () => {
    expect(normalizeApiServerUrl("https://api.kaneo.app")).toBe(
      "https://api.kaneo.app/api",
    );
    expect(normalizeApiServerUrl("https://api.kaneo.app/api/")).toBe(
      "https://api.kaneo.app/api",
    );
  });

  it("normalizes organization auth operations and prunes components", () => {
    const authSpec = {
      paths: {
        "/organization/list-members": {
          get: {
            operationId: "oldId",
            summary: "Old summary",
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/MemberList" },
                  },
                },
              },
            },
          },
        },
        "/session/get": {
          get: {
            operationId: "ignored",
          },
        },
      },
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer" },
        },
        schemas: {
          MemberList: {
            type: "object",
            properties: {
              data: {
                $ref: "#/components/schemas/Member",
              },
            },
          },
          Member: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
          },
          Ignored: {
            type: "object",
          },
        },
      },
    };

    const normalized = normalizeOrganizationAuthOperations(authSpec);

    expect(Object.keys(normalized.paths as Record<string, unknown>)).toEqual([
      "/auth/organization/list-members",
    ]);

    const operation = (
      normalized.paths as Record<
        string,
        Record<string, Record<string, unknown>>
      >
    )["/auth/organization/list-members"].get;

    expect(operation.operationId).toBe("listOrganizationMembers");
    expect(operation.summary).toBe("List Organization Members");
    expect(operation.tags).toEqual(["Organization Management"]);

    const schemaNames = Object.keys(
      (
        normalized.components as {
          schemas?: Record<string, unknown>;
        }
      ).schemas || {},
    );
    expect(schemaNames).toEqual(["MemberList", "Member"]);
  });

  it("merges hono and auth specs", () => {
    const merged = mergeOpenApiSpecs(
      {
        openapi: "3.1.0",
        info: { title: "API" },
        paths: { "/tasks": { get: { operationId: "getTasks" } } },
        tags: [{ name: "Tasks" }],
        components: {
          schemas: { Task: { type: "object" } },
        },
      },
      {
        paths: { "/auth/session": { get: { operationId: "getSession" } } },
        tags: [{ name: "Auth" }],
        components: {
          securitySchemes: { bearerAuth: { type: "http" } },
          schemas: { Session: { type: "object" } },
        },
      },
    );

    expect(merged.openapi).toBe("3.1.0");
    expect(Object.keys(merged.paths)).toEqual(["/tasks", "/auth/session"]);
    expect(merged.tags).toEqual([{ name: "Tasks" }, { name: "Auth" }]);
    expect(merged.components.schemas).toEqual({
      Task: { type: "object" },
      Session: { type: "object" },
    });
    expect(merged.components.securitySchemes).toEqual({
      bearerAuth: { type: "http" },
    });
  });

  it("dedupes operation ids using method and path", () => {
    const spec = dedupeOperationIds({
      paths: {
        "/tasks": {
          get: { operationId: "getTask" },
        },
        "/tasks/{id}": {
          get: { operationId: "getTask" },
        },
      },
    });

    expect(
      (spec.paths as Record<string, Record<string, { operationId: string }>>)[
        "/tasks/{id}"
      ].get.operationId,
    ).toBe("getTask_get_tasks_id");
  });

  it("normalizes nullable schemas and empty required arrays", () => {
    const spec = normalizeEmptyRequiredArrays(
      normalizeNullableSchemasForOpenApi30({
        components: {
          schemas: {
            Example: {
              type: ["string", "null"],
              required: [],
            },
            ExampleAnyOf: {
              anyOf: [{ type: "null" }, { type: "number", minimum: 1 }],
            },
          },
        },
      }),
    );

    expect(
      (
        spec.components as {
          schemas: Record<string, Record<string, unknown>>;
        }
      ).schemas.Example,
    ).toEqual({
      type: "string",
      nullable: true,
    });

    expect(
      (
        spec.components as {
          schemas: Record<string, Record<string, unknown>>;
        }
      ).schemas.ExampleAnyOf,
    ).toEqual({
      type: "number",
      minimum: 1,
      nullable: true,
    });
  });

  it("marks optional schema fields nullable and fills missing summaries", () => {
    const spec = ensureOperationSummaries(
      markOptionalSchemaFieldsNullable({
        paths: {
          "/tasks": {
            get: {
              operationId: "listWorkspaceTasks",
            },
          },
        },
        components: {
          schemas: {
            Task: {
              type: "object",
              required: ["id"],
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                estimate: { type: "number", nullable: true },
              },
            },
          },
        },
      }),
    );

    expect(
      (
        spec.components as {
          schemas: Record<
            string,
            { properties: Record<string, Record<string, unknown>> }
          >;
        }
      ).schemas.Task.properties.title.nullable,
    ).toBe(true);
    expect(
      (
        spec.components as {
          schemas: Record<
            string,
            { properties: Record<string, Record<string, unknown>> }
          >;
        }
      ).schemas.Task.properties.id.nullable,
    ).toBeUndefined();
    expect(
      (
        spec.paths as Record<
          string,
          Record<string, { summary?: string; operationId: string }>
        >
      )["/tasks"].get.summary,
    ).toBe("List Workspace Tasks");
  });
});
