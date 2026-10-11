import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { blockedDestinationError } from "./blocked-destination-error";
import { createGuardedFetch, MAX_IMPORT_REDIRECTS } from "./guarded-fetch";

const PUBLIC = "http://93.184.216.34";
const OTHER_PUBLIC = "http://93.184.216.35";

function redirect(location: string, status = 302) {
  return new Response(null, { status, headers: { location } });
}

describe("createGuardedFetch", () => {
  beforeEach(() => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends public requests without following redirects automatically", async () => {
    const baseFetch = vi.fn(async () => new Response("ok"));
    const guard = createGuardedFetch("PLANKA", { baseFetch });

    const response = await guard.fetch(`${PUBLIC}/api/projects`, {
      headers: { Authorization: "Bearer secret" },
    });

    expect(await response.text()).toBe("ok");
    expect(baseFetch).toHaveBeenCalledWith(
      `${PUBLIC}/api/projects`,
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(guard.failure()).toBeNull();
    expect(guard.lastHost()).toBe("93.184.216.34");
  });

  it("refuses private destinations before sending anything", async () => {
    const baseFetch = vi.fn(async () => new Response("ok"));
    const guard = createGuardedFetch("PLANKA", { baseFetch });

    await expect(guard.fetch("http://10.0.0.5/api")).rejects.toThrow(
      "PLANKA destination resolves to a non-routable address",
    );
    expect(baseFetch).not.toHaveBeenCalled();
    expect(guard.failure()).toEqual({
      kind: "destination",
      message: "PLANKA destination resolves to a non-routable address",
    });
  });

  it("allows private destinations when the instance opts in", async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    const baseFetch = vi.fn(async () => new Response("ok"));
    const guard = createGuardedFetch("PLANKA", { baseFetch });

    await expect(guard.fetch("http://10.0.0.5/api")).resolves.toBeInstanceOf(
      Response,
    );
  });

  it("checks every redirect hop", async () => {
    const baseFetch = vi.fn(async () => redirect("http://127.0.0.1/admin"));
    const guard = createGuardedFetch("Kaneo", { baseFetch });

    await expect(guard.fetch(`${PUBLIC}/api`)).rejects.toThrow("non-routable");
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps credentials on the same origin and drops them across sites", async () => {
    const baseFetch = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(redirect(`${PUBLIC}/v2/api`, 307))
      .mockResolvedValueOnce(redirect(`${OTHER_PUBLIC}/api`, 307))
      .mockResolvedValueOnce(new Response("done"));
    const guard = createGuardedFetch("Plane", { baseFetch });

    await guard.fetch(`${PUBLIC}/api`, {
      method: "POST",
      body: "{}",
      headers: {
        "X-API-Key": "secret",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const headersOf = (call: number) =>
      new Headers(baseFetch.mock.calls[call]?.[1]?.headers);
    expect(headersOf(1).get("x-api-key")).toBe("secret");
    expect(headersOf(2).get("x-api-key")).toBeNull();
    expect(headersOf(2).get("accept")).toBe("application/json");
    expect(baseFetch.mock.calls[2]?.[1]?.method).toBe("POST");
    expect(baseFetch.mock.calls[2]?.[0]).toBe(`${OTHER_PUBLIC}/api`);
  });

  it("turns a 303 into a GET without a body", async () => {
    const baseFetch = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(redirect(`${PUBLIC}/done`, 303))
      .mockResolvedValueOnce(new Response("done"));
    const guard = createGuardedFetch("Kaneo", { baseFetch });

    await guard.fetch(`${PUBLIC}/api`, { method: "POST", body: "{}" });

    expect(baseFetch.mock.calls[1]?.[1]?.method).toBe("GET");
    expect(baseFetch.mock.calls[1]?.[1]?.body).toBeUndefined();
  });

  it("gives up after a few redirects", async () => {
    const baseFetch = vi.fn(async () => redirect(`${PUBLIC}/loop`));
    const guard = createGuardedFetch("PLANKA", { baseFetch });

    await expect(guard.fetch(`${PUBLIC}/api`)).rejects.toThrow(
      "PLANKA redirected too many times. Check the URL.",
    );
    expect(baseFetch).toHaveBeenCalledTimes(MAX_IMPORT_REDIRECTS + 1);
  });

  it("records network failures unless the import was cancelled", async () => {
    const baseFetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const guard = createGuardedFetch("PLANKA", { baseFetch });

    await expect(guard.fetch(`${PUBLIC}/api`)).rejects.toThrow("fetch failed");
    expect(guard.failure()).toEqual({
      kind: "unreachable",
      host: "93.184.216.34",
    });

    const controller = new AbortController();
    controller.abort();
    const cancelled = createGuardedFetch("PLANKA", {
      baseFetch,
      cancelSignal: controller.signal,
    });
    await expect(cancelled.fetch(`${PUBLIC}/api`)).rejects.toThrow();
    expect(cancelled.failure()).toBeNull();
  });

  it("reports a host that resolves to a private address at connect time as a destination problem", async () => {
    const baseFetch = vi.fn(async () => {
      throw new TypeError("fetch failed", {
        cause: blockedDestinationError(),
      });
    });
    const guard = createGuardedFetch("PLANKA", { baseFetch });

    await expect(guard.fetch(`${PUBLIC}/api`)).rejects.toThrow(
      "PLANKA destination resolves to a non-routable address",
    );
    expect(guard.failure()).toEqual({
      kind: "destination",
      message: "PLANKA destination resolves to a non-routable address",
    });
  });

  it("rejects malformed URLs as a destination problem", async () => {
    const guard = createGuardedFetch("PLANKA", {
      baseFetch: vi.fn(async () => new Response("ok")),
    });

    await expect(guard.fetch("https://exa mple.com/api")).rejects.toThrow(
      "Enter a valid PLANKA URL.",
    );
  });
});
