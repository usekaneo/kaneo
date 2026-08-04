import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    resolveCalls: 0,
    validateCalls: [] as { userId: string; workspaceId: string }[],
    caller: "anonymous" as "anonymous" | "member" | "outsider",
  },
}));

vi.mock("../../../apps/api/src/utils/authenticate-api-request", () => ({
  // Mirrors the real helper: every unauthenticated path throws, so it never
  // returns a falsy userId.
  resolveAssetBearerOrCookie: async () => {
    state.resolveCalls += 1;
    if (state.caller === "anonymous") {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    return { userId: `user-${state.caller}` };
  },
}));

vi.mock("../../../apps/api/src/utils/validate-workspace-access", () => ({
  validateWorkspaceAccess: async (userId: string, workspaceId: string) => {
    state.validateCalls.push({ userId, workspaceId });
    if (userId !== "user-member") {
      throw new HTTPException(403, {
        message: "You don't have access to this workspace",
      });
    }
  },
}));

const { authorizeAssetAccess } = await import(
  "../../../apps/api/src/utils/authorize-asset-access"
);

const context = {} as Context;

async function statusOf(promise: Promise<void>) {
  try {
    await promise;
    return 200;
  } catch (error) {
    return error instanceof HTTPException ? error.status : 500;
  }
}

describe("authorizeAssetAccess", () => {
  beforeEach(() => {
    state.resolveCalls = 0;
    state.validateCalls = [];
    state.caller = "anonymous";
  });

  it("allows an anonymous caller to read an asset of a public project", async () => {
    const status = await statusOf(
      authorizeAssetAccess(context, {
        workspaceId: "workspace-1",
        isPublic: true,
      }),
    );

    expect(status).toBe(200);
    // The credential check must be skipped entirely: it throws for anonymous
    // callers, which is what made the public branch unreachable.
    expect(state.resolveCalls).toBe(0);
  });

  it("rejects an anonymous caller for a private asset", async () => {
    const status = await statusOf(
      authorizeAssetAccess(context, {
        workspaceId: "workspace-1",
        isPublic: false,
      }),
    );

    expect(status).toBe(401);
  });

  it("rejects an authenticated non-member for a private asset", async () => {
    state.caller = "outsider";

    const status = await statusOf(
      authorizeAssetAccess(context, {
        workspaceId: "workspace-1",
        isPublic: null,
      }),
    );

    expect(status).toBe(403);
  });

  it("allows a workspace member to read a private asset", async () => {
    state.caller = "member";

    const status = await statusOf(
      authorizeAssetAccess(context, {
        workspaceId: "workspace-1",
        isPublic: false,
      }),
    );

    expect(status).toBe(200);
    expect(state.validateCalls).toEqual([
      { userId: "user-member", workspaceId: "workspace-1" },
    ]);
  });
});
