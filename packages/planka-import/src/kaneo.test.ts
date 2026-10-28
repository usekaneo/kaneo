import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { KaneoClient } from "./kaneo.js";

function limited(retryAfter?: string): Response {
  return new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
    status: 429,
    headers: retryAfter ? { "Retry-After": retryAfter } : {},
  });
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("KaneoClient rate limiting", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("waits for Retry-After, reports the wait, and retries", async () => {
    fetchMock
      .mockResolvedValueOnce(limited("30"))
      .mockResolvedValueOnce(ok([]));
    const onRateLimit = vi.fn();
    const client = new KaneoClient({
      baseUrl: "https://kaneo.test",
      apiKey: "key",
      onRateLimit,
    });

    const result = client.listWorkspaces();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRateLimit).toHaveBeenCalledWith(30_000);
  });

  it("fails fast when Retry-After is a long usage quota", async () => {
    fetchMock.mockResolvedValueOnce(limited(String(6 * 3600)));
    const client = new KaneoClient({
      baseUrl: "https://kaneo.test",
      apiKey: "key",
    });

    await expect(client.listWorkspaces()).rejects.toThrow(
      /usage limit reached.*retry in about 6 h/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails when a 429 has no Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(limited());
    const client = new KaneoClient({
      baseUrl: "https://kaneo.test",
      apiKey: "key",
    });

    await expect(client.listWorkspaces()).rejects.toThrow(
      /rate limited \(HTTP 429\)/,
    );
  });

  it("gives up after repeated 429s", async () => {
    fetchMock.mockImplementation(async () => limited("1"));
    const client = new KaneoClient({
      baseUrl: "https://kaneo.test",
      apiKey: "key",
    });

    const result = client.listWorkspaces();
    const assertion = expect(result).rejects.toThrow(/rate limited/);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps 401 meaning a bad key", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );
    const client = new KaneoClient({
      baseUrl: "https://kaneo.test",
      apiKey: "key",
    });

    await expect(client.listWorkspaces()).rejects.toThrow(
      /check your Kaneo API key/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
