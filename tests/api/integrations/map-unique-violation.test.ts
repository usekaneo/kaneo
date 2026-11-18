import { describe, expect, it } from "vite-plus/test";
import { HTTPException } from "hono/http-exception";
import {
  INTEGRATION_PROJECT_TYPE_REPO_UNIQUE,
  isDatabaseUniqueViolation,
  mapIntegrationUniqueViolation,
} from "../../../apps/api/src/integrations/map-unique-violation";

function pgUniqueViolation(constraint = INTEGRATION_PROJECT_TYPE_REPO_UNIQUE) {
  const error = new Error("duplicate key value violates unique constraint");
  return Object.assign(error, { code: "23505", constraint });
}

function drizzleWrapped(violation: Error) {
  return new Error('Failed query: insert into "integration"', {
    cause: violation,
  });
}

async function catchConflict(
  error: unknown,
  context: { projectId?: string; type?: string },
): Promise<HTTPException> {
  let thrown: unknown;
  try {
    mapIntegrationUniqueViolation(error, context);
  } catch (caught) {
    thrown = caught;
  }
  expect(thrown).toBeInstanceOf(HTTPException);
  const conflict = thrown as HTTPException;
  expect(conflict.status).toBe(409);
  return conflict;
}

describe("mapIntegrationUniqueViolation", () => {
  it("maps a direct 23505 on the binding constraint to a 409 conflict", async () => {
    const conflict = await catchConflict(pgUniqueViolation(), {
      projectId: "project-1",
      type: "github",
    });
    const body = (await conflict.res?.json()) as {
      code: string;
      message: string;
      projectId: string;
      type: string;
    };
    expect(body.code).toBe("repository_already_linked");
    expect(body.projectId).toBe("project-1");
    expect(body.type).toBe("github");
  });

  it("detects the violation through a drizzle-orm wrapper's cause chain", async () => {
    const violation = drizzleWrapped(pgUniqueViolation());
    expect(isDatabaseUniqueViolation(violation)).toBe(true);
    const conflict = await catchConflict(violation, {
      projectId: "project-1",
      type: "gitea",
    });
    const body = (await conflict.res?.json()) as { code: string };
    expect(body.code).toBe("repository_already_linked");
  });

  it("re-throws 23505 errors of other constraints unchanged", () => {
    const otherConstraint = pgUniqueViolation(
      "integration_project_type_null_repo_unique",
    );
    expect(() =>
      mapIntegrationUniqueViolation(otherConstraint, {
        projectId: "project-1",
        type: "github",
      }),
    ).toThrow(otherConstraint);
  });

  it("re-throws errors that are not unique violations", () => {
    const failure = new Error("connection refused");
    expect(() =>
      mapIntegrationUniqueViolation(drizzleWrapped(failure), {
        projectId: "project-1",
        type: "gitlab",
      }),
    ).toThrow(failure);
  });

  it("stops the cause walk before an infinite cycle", () => {
    const cyclic: Error & { cause?: unknown } = new Error("cycle");
    cyclic.cause = cyclic;
    expect(isDatabaseUniqueViolation(cyclic)).toBe(false);
  });
});
