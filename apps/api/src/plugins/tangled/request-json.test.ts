import { fetch } from "undici";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { requestTangledJson } from "./request-json";

vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return { ...actual, fetch: vi.fn() };
});

const url = new URL(
  "https://api.tangled.example/xrpc/org.tangled.temp.git.getRef?repo=did:plc:repo&ref=refs/heads/main",
);

function respond(response: Response): void {
  vi.mocked(fetch).mockResolvedValue(
    response as unknown as Awaited<ReturnType<typeof fetch>>,
  );
}

beforeEach(() => vi.mocked(fetch).mockReset());
afterEach(() => vi.useRealTimers());

describe("requestTangledJson", () => {
  it("requests JSON without redirects and uses a guarded dispatcher", async () => {
    respond(Response.json({ name: "refs/heads/main", oid: "a".repeat(40) }));
    await expect(requestTangledJson(url)).resolves.toEqual({
      name: "refs/heads/main",
      oid: "a".repeat(40),
    });
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        redirect: "manual",
        method: "GET",
        signal: expect.any(AbortSignal),
        dispatcher: expect.objectContaining({ dispatch: expect.any(Function) }),
      }),
    );
  });

  it.each([301, 302, 307, 308])(
    "does not follow an HTTP %s redirect",
    async (status) => {
      respond(
        new Response(null, {
          status,
          headers: { location: "https://127.0.0.1/secret" },
        }),
      );
      await expect(requestTangledJson(url)).rejects.toThrow(/HTTP/);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("distinguishes a missing Git ref from a missing repository without leaking the upstream message", async () => {
    respond(
      Response.json(
        { error: "RefNotFound", message: "private-upstream-detail" },
        { status: 404 },
      ),
    );
    const error = await requestTangledJson(url).catch(
      (error: unknown) => error,
    );
    expect(error).toMatchObject({ code: "ref_not_found" });
    expect((error as Error).message).not.toContain("private-upstream-detail");
  });

  it("does not misclassify a missing repository as a missing ref", async () => {
    respond(Response.json({ error: "RepoNotFound" }, { status: 404 }));
    const error = await requestTangledJson(url).catch(
      (error: unknown) => error,
    );
    expect(error).not.toMatchObject({ code: "ref_not_found" });
    expect((error as Error).message).toMatch(/HTTP 404/);
  });

  it("does not expose upstream error bodies", async () => {
    respond(new Response("upstream-secret", { status: 503 }));
    const error = await requestTangledJson(url).catch(
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/HTTP 503/);
    expect((error as Error).message).not.toContain("upstream-secret");
  });

  it("rejects non-JSON success responses", async () => {
    respond(
      new Response("<html>login</html>", {
        headers: { "content-type": "text/html" },
      }),
    );
    await expect(requestTangledJson(url)).rejects.toThrow(/JSON/);
  });

  it("rejects malformed JSON without echoing it", async () => {
    respond(
      new Response("invalid-secret", {
        headers: { "content-type": "application/json" },
      }),
    );
    const error = await requestTangledJson(url).catch(
      (error: unknown) => error,
    );
    expect((error as Error).message).toMatch(/JSON/);
    expect((error as Error).message).not.toContain("invalid-secret");
  });

  it("cancels a response whose advertised size exceeds one MiB", async () => {
    const cancel = vi.fn();
    respond(
      new Response(new ReadableStream({ cancel }), {
        headers: {
          "content-type": "application/json",
          "content-length": "1048577",
        },
      }),
    );
    await expect(requestTangledJson(url)).rejects.toThrow(/too large/);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("bounds streamed bytes when Content-Length is missing or false", async () => {
    const cancel = vi.fn();
    let pulls = 0;
    respond(
      new Response(
        new ReadableStream({
          pull(controller) {
            pulls++;
            controller.enqueue(new Uint8Array(600_000));
          },
          cancel,
        }),
        {
          headers: {
            "content-type": "application/json",
            "content-length": "1",
          },
        },
      ),
    );
    await expect(requestTangledJson(url)).rejects.toThrow(/too large/);
    expect(cancel).toHaveBeenCalledOnce();
    expect(pulls).toBeLessThan(5);
  });

  it("aborts a stalled response body within ten seconds", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    respond(
      new Response(new ReadableStream({ cancel }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const assertion = expect(requestTangledJson(url)).rejects.toThrow(
      /timed out/,
    );
    await vi.advanceTimersByTimeAsync(10_001);
    await assertion;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    "http://api.tangled.example/xrpc/method",
    "https://127.0.0.1/xrpc/method",
    "https://[::1]/xrpc/method",
    "https://user:secret@api.tangled.example/xrpc/method",
    "https://api.tangled.example:8443/xrpc/method",
  ])(
    "rejects forbidden URL forms before making a request: %s",
    async (input) => {
      await expect(requestTangledJson(new URL(input))).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
