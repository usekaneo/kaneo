import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import importGithubIssues from "./import-github-issues";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@kaneo/libs", () => ({
  client: { "github-integration": { "import-issues": { $post: request } } },
}));
const progress = {
  runId: "run-1",
  pending: true,
  imported: 4,
  updated: 0,
  skipped: 0,
};
beforeEach(() => {
  request.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});
describe("resumable GitHub import client", () => {
  it("awaits each page and carries the run ID until completion", async () => {
    let resolve!: (response: Response) => void;
    request
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValueOnce(
        Response.json({ ...progress, imported: 8 }, { status: 202 }),
      )
      .mockResolvedValueOnce(
        Response.json({ ...progress, pending: false, imported: 9 }),
      );
    let finished = false;
    const pending = importGithubIssues({ projectId: "project" }).then(
      (result) => {
        finished = true;
        return result;
      },
    );
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    expect(finished).toBe(false);
    resolve(Response.json(progress, { status: 202 }));
    await expect(pending).resolves.toMatchObject({
      pending: false,
      imported: 9,
    });
    expect(request.mock.calls).toEqual([
      [{ json: { projectId: "project", runId: undefined } }],
      [{ json: { projectId: "project", runId: "run-1" } }],
      [{ json: { projectId: "project", runId: "run-1" } }],
    ]);
  });
  it("resumes a saved run after refresh", async () => {
    request.mockResolvedValueOnce(
      Response.json({ ...progress, pending: false }),
    );
    await importGithubIssues({ projectId: "project", runId: "run-1" });
    expect(request).toHaveBeenCalledWith({
      json: { projectId: "project", runId: "run-1" },
    });
  });
  it("surfaces failures after partial progress instead of reporting success", async () => {
    request
      .mockResolvedValueOnce(Response.json(progress, { status: 202 }))
      .mockRejectedValueOnce(new TypeError("connection lost"));
    await expect(importGithubIssues({ projectId: "project" })).rejects.toThrow(
      "connection lost",
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("backs off for busy imports and stops after five retries", async () => {
    vi.useFakeTimers();
    request.mockImplementation(
      async () => new Response("busy", { status: 429 }),
    );
    const pending = importGithubIssues({ projectId: "project" });
    const rejection = expect(pending).rejects.toMatchObject({ status: 429 });
    await vi.advanceTimersByTimeAsync(999);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4001);
    await rejection;
    expect(request).toHaveBeenCalledTimes(6);
  });
  it.each([403, 409, 502])(
    "does not automatically restart on HTTP %i",
    async (status) => {
      request.mockResolvedValueOnce(new Response("paused", { status }));
      await expect(
        importGithubIssues({ projectId: "project", runId: "run-1" }),
      ).rejects.toMatchObject({ status });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
});
