import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  boundedGithubFetch,
  GITHUB_IMPORT_REQUEST_TIMEOUT_MS,
  MAX_GITHUB_IMPORT_RESPONSE_BYTES,
} from "../../../apps/api/src/utils/bounded-github-fetch";

vi.mock("dotenv-mono", () => ({ config: () => {} }));
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const url = "https://api.github.com/graphql";

describe("bounded GitHub import transport", () => {
  it("preserves successful JSON, headers and status while disabling redirects", async () => {
    request.mockResolvedValue(
      Response.json(
        { data: { ok: true } },
        { headers: { "x-ratelimit-remaining": "5" } },
      ),
    );
    const response = await boundedGithubFetch(url, { method: "POST" });
    expect(await response.json()).toEqual({ data: { ok: true } });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-remaining")).toBe("5");
    expect(request.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      method: "POST",
    });
  });

  it.each([null, "1"])(
    "bounds actual decoded bytes with Content-Length %s and cancels the stream",
    async (length) => {
      const cancel = vi.fn();
      let chunks = 0;
      request.mockResolvedValue(
        new Response(
          new ReadableStream({
            pull(controller) {
              chunks++;
              controller.enqueue(new Uint8Array(1024 * 1024));
            },
            cancel,
          }),
          { headers: length ? { "Content-Length": length } : {} },
        ),
      );
      await expect(boundedGithubFetch(url)).rejects.toThrow("too large");
      expect(chunks).toBeLessThanOrEqual(
        MAX_GITHUB_IMPORT_RESPONSE_BYTES / (1024 * 1024) + 2,
      );
      expect(cancel).toHaveBeenCalledOnce();
      expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
    },
  );

  it("accepts the exact byte limit without truncation", async () => {
    request.mockResolvedValue(
      new Response(new Uint8Array(MAX_GITHUB_IMPORT_RESPONSE_BYTES)),
    );
    expect(
      (await (await boundedGithubFetch(url)).arrayBuffer()).byteLength,
    ).toBe(MAX_GITHUB_IMPORT_RESPONSE_BYTES);
  });

  it("times out before headers and cancels a late response", async () => {
    vi.useFakeTimers();
    let finish!: (response: Response) => void;
    request.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = boundedGithubFetch(url);
    const rejected = expect(pending).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(GITHUB_IMPORT_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
    const cancel = vi.fn();
    finish(new Response(new ReadableStream({ cancel })));
    await Promise.resolve();
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("times out on a stalled body even after successful headers", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    request.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const pending = boundedGithubFetch(url);
    const rejected = expect(pending).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(GITHUB_IMPORT_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("passes through the caller's abort signal", async () => {
    const controller = new AbortController();
    controller.abort();
    request.mockImplementation(async (_url, init) => {
      init?.signal?.throwIfAborted();
      return Response.json({});
    });
    await expect(
      boundedGithubFetch(url, { signal: controller.signal }),
    ).rejects.toThrow();
  });

  it("applies bounded transport to real App authentication and installation clients without SDK retries", async () => {
    vi.resetModules();
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    vi.stubEnv("GITHUB_APP_ID", "123");
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "test-only-secret");
    vi.stubEnv("GITHUB_PRIVATE_KEY_BASE64", "");
    vi.stubEnv("GITHUB_PRIVATE_KEY", privateKey);
    request.mockImplementation(async (input) => {
      if (String(input).includes("/access_tokens"))
        return Response.json(
          {
            token: "test-only-token",
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          },
          { status: 201 },
        );
      if (String(input).includes("/repos/")) return Response.json({ id: 2 });
      return Response.json(
        { message: "rate limited" },
        {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
          },
        },
      );
    });
    const { getVerifiedInstallationOctokit } = await import(
      "../../../apps/api/src/plugins/github/utils/github-app"
    );
    const octokit = await getVerifiedInstallationOctokit(
      {
        repositoryOwner: "example",
        repositoryName: "repo",
        repositoryId: 2,
        installationId: 1,
        verifiedGithubAccountId: "3",
        verifiedByUserId: "test-user",
      },
      true,
    );
    await expect(
      octokit.graphql("query { viewer { login } }"),
    ).rejects.toMatchObject({ status: 403 });
    expect(request).toHaveBeenCalledTimes(3);
    for (const [, init] of request.mock.calls)
      expect(init).toMatchObject({
        redirect: "error",
        signal: expect.any(AbortSignal),
      });
  });
});
