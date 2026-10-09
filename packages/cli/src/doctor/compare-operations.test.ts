import { describe, expect, it } from "vite-plus/test";
import {
  documentedOperations,
  missingOperations,
  operationKey,
} from "./compare-operations.js";
import { REQUIRED_OPERATIONS } from "./required-operations.js";

const document = {
  openapi: "3.1.0",
  servers: [{ url: "https://cloud.kaneo.app/api" }],
  paths: {
    "/user/me": { get: {} },
    "/task/{id}": { get: {}, put: {}, delete: {}, parameters: [] },
    "/task/assigned": { get: {} },
    "/project": { get: {}, post: {} },
  },
};

describe("operationKey", () => {
  it("ignores the /api prefix, parameter names and trailing slashes", () => {
    expect(operationKey("get", "/api/task/{taskId}")).toBe("GET /task/{}");
    expect(operationKey("GET", "/task/{id}/")).toBe("GET /task/{}");
    expect(operationKey("put", "/api/task/:id")).toBe("PUT /task/{}");
    expect(operationKey("get", "/api")).toBe("GET /");
  });
});

describe("missingOperations", () => {
  it("lists the operations the server does not document", () => {
    expect(
      missingOperations(
        [
          { method: "GET", path: "/api/user/me" },
          { method: "GET", path: "/api/task/{ticketId}" },
          { method: "PATCH", path: "/api/task/{id}" },
          { method: "GET", path: "/api/task/assigned" },
          { method: "DELETE", path: "/api/project/{id}" },
        ],
        document,
      ),
    ).toEqual([
      { method: "PATCH", path: "/api/task/{id}" },
      { method: "DELETE", path: "/api/project/{id}" },
    ]);
  });

  it("skips keys that are not HTTP methods", () => {
    expect(documentedOperations(document)?.has("PARAMETERS /task/{}")).toBe(
      false,
    );
  });

  it("returns nothing for a document without paths", () => {
    expect(
      missingOperations(REQUIRED_OPERATIONS, { openapi: "3.1.0" }),
    ).toBeUndefined();
    expect(missingOperations(REQUIRED_OPERATIONS, "<html>")).toBeUndefined();
  });

  it("lists every required operation once", () => {
    const keys = REQUIRED_OPERATIONS.map((operation) =>
      operationKey(operation.method, operation.path),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
