import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { giteaFetch } from "../../../apps/api/src/plugins/gitea/utils/gitea-api";

const dnsMock = vi.hoisted(() => ({
  lookup:
    vi.fn<
      (
        hostname: string,
        options: { all: true; verbatim: true },
      ) => Promise<Array<{ address: string; family: number }>>
    >(),
}));
vi.mock("node:dns/promises", () => dnsMock);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "false");
  dnsMock.lookup.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("bounds DNS resolution and never sends a delayed mutation after the deadline", async () => {
  const dns =
    Promise.withResolvers<Array<{ address: string; family: number }>>();
  dnsMock.lookup.mockReturnValue(dns.promise);
  const fetch = vi.fn(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  const result = giteaFetch(
    "https://gitea.example",
    "test-only",
    "/repos/owner/repo/issues",
    {
      method: "POST",
      body: JSON.stringify({ title: "must not send" }),
    },
  ).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(await result).toMatchObject({
    name: "GiteaApiError",
    kind: "TIMEOUT",
    status: 408,
  });
  expect(fetch).not.toHaveBeenCalled();
  dns.resolve([{ address: "93.184.216.34", family: 4 }]);
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).not.toHaveBeenCalled();
});

it("bounds a transport that ignores AbortSignal", async () => {
  dnsMock.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  const transport = Promise.withResolvers<Response>();
  const fetch = vi.fn((_url: string, _init?: RequestInit) => transport.promise);
  vi.stubGlobal("fetch", fetch);
  const result = giteaFetch(
    "https://gitea.example",
    "test-only",
    "/user",
  ).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(await result).toMatchObject({
    name: "GiteaApiError",
    kind: "TIMEOUT",
    status: 408,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

it("uses one deadline for DNS plus response body, not a fresh timeout after DNS", async () => {
  const dns =
    Promise.withResolvers<Array<{ address: string; family: number }>>();
  dnsMock.lookup.mockReturnValue(dns.promise);
  const responseBody = Promise.withResolvers<string>();
  const body = vi.fn(() => responseBody.promise);
  const fetch = vi.fn(async () => ({ status: 200, ok: true, text: body }));
  vi.stubGlobal("fetch", fetch);
  const result = giteaFetch(
    "https://gitea.example",
    "test-only",
    "/user",
  ).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(6_000);
  dns.resolve([{ address: "93.184.216.34", family: 4 }]);
  await vi.advanceTimersByTimeAsync(0);
  expect(body).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(await result).toMatchObject({
    name: "GiteaApiError",
    kind: "TIMEOUT",
    status: 408,
  });
});

it("caller cancellation during DNS cannot produce a later fetch", async () => {
  const dns =
    Promise.withResolvers<Array<{ address: string; family: number }>>();
  dnsMock.lookup.mockReturnValue(dns.promise);
  const fetch = vi.fn(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  const result = giteaFetch("https://gitea.example", "test-only", "/user", {
    signal: controller.signal,
  }).catch((error: unknown) => error);
  controller.abort();
  await vi.advanceTimersByTimeAsync(0);
  expect(await result).toMatchObject({ name: "AbortError" });
  dns.resolve([{ address: "93.184.216.34", family: 4 }]);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(fetch).not.toHaveBeenCalled();
});
