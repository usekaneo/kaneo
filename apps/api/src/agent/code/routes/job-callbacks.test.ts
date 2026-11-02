import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../callbacks", async () => {
  const { HTTPException } = await import("hono/http-exception");
  const authenticateJob = vi.fn(async (_jobId: string, token: string) => {
    if (token !== "valid-credential")
      throw new HTTPException(403, { message: "Invalid credential" });
    return {};
  });
  return {
    authenticateJob,
    claimJob: vi.fn(),
    heartbeatJob: vi.fn(async (jobId: string, token: string) => {
      await authenticateJob(jobId, token);
      return { cancelRequested: false };
    }),
    failJob: vi.fn(async (jobId: string, token: string) => {
      await authenticateJob(jobId, token);
      return { accepted: true };
    }),
    uploadChangeset: vi.fn(async (jobId: string, token: string) => {
      await authenticateJob(jobId, token);
      return { accepted: true };
    }),
  };
});

import callbacks from "./job-callbacks";

describe("authenticated callback quotas", () => {
  it.each([
    { path: "heartbeat", body: {}, success: 200 },
    { path: "fail", body: { code: "agent_failed" }, success: 200 },
    {
      path: "changeset",
      body: { outcome: "no_changes", summary: "No changes" },
      success: 202,
    },
  ])(
    "keeps invalid $path calls out of the job quota",
    async ({ path, body, success }) => {
      const jobId = randomUUID();
      const post = (token: string) =>
        callbacks.request(`/${jobId}/${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      for (let index = 0; index < 125; index++)
        expect((await post("invalid-credential")).status).toBe(403);
      expect((await post("valid-credential")).status).toBe(success);
    },
  );

  it("still enforces the authenticated job quota", async () => {
    const jobId = randomUUID();
    const post = () =>
      callbacks.request(`/${jobId}/heartbeat`, {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-credential",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    for (let index = 0; index < 120; index++)
      expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(429);
  });
});
