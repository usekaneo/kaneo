import { Effect, Layer } from "effect";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import { describe, expect, it } from "vite-plus/test";
import { testSession } from "../testing/test-layers.js";
import { fetchImage, MAX_IMAGE_BYTES } from "./fetch-image.js";

type Seen = {
  readonly url: string;
  readonly authorization: string | undefined;
};

function image(bytes: ArrayLike<number>, type = "image/png") {
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": type },
  });
}

function run(raw: string, respond: (seen: Seen) => Response | "fail") {
  const seen: Seen[] = [];
  const client = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      const entry = {
        url: url.toString(),
        authorization: request.headers.authorization,
      };
      seen.push(entry);
      const response = respond(entry);
      return response === "fail"
        ? Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({ request }),
            }),
          )
        : Effect.succeed(HttpClientResponse.fromWeb(request, response));
    }),
  );
  const result = Effect.runPromise(
    fetchImage(raw).pipe(Effect.provide(Layer.merge(client, testSession()))),
  );
  return { seen, result };
}

describe("fetchImage", () => {
  it("sends the token to assets on the signed-in server", async () => {
    const { seen, result } = run("/api/asset/a1", () => image([1, 2, 3]));
    const fetched = await result;
    expect(seen).toEqual([
      {
        url: "https://kaneo.test/api/asset/a1",
        authorization: "Bearer test-token",
      },
    ]);
    expect(fetched._tag).toBe("Fetched");
    if (fetched._tag === "Fetched") {
      expect([...fetched.bytes]).toEqual([1, 2, 3]);
      expect(fetched.contentType).toBe("image/png");
    }
  });

  it("never sends the token to third-party hosts", async () => {
    const { seen, result } = run("https://cdn.test/a.png", () => image([1]));
    expect((await result)._tag).toBe("Fetched");
    expect(seen[0]?.authorization).toBeUndefined();
  });

  it("drops the token when a redirect leaves the server", async () => {
    const { seen, result } = run("/api/asset/a1", ({ url }) =>
      url.startsWith("https://kaneo.test")
        ? new Response(null, {
            status: 302,
            headers: { location: "https://bucket.test/a1?sig=1" },
          })
        : image([7]),
    );
    expect((await result)._tag).toBe("Fetched");
    expect(seen).toEqual([
      {
        url: "https://kaneo.test/api/asset/a1",
        authorization: "Bearer test-token",
      },
      { url: "https://bucket.test/a1?sig=1", authorization: undefined },
    ]);
  });

  it("turns failures into reasons instead of errors", async () => {
    const reason = async (raw: string, respond: () => Response | "fail") => {
      const fetched = await run(raw, respond).result;
      return fetched._tag === "Unavailable" ? fetched.reason : null;
    };
    expect(
      await reason("/api/asset/x", () => new Response("", { status: 404 })),
    ).toBe("not found");
    expect(
      await reason("/api/asset/x", () => new Response("", { status: 403 })),
    ).toBe("no access");
    expect(
      await reason(
        "/api/asset/x",
        () =>
          new Response("<html>", { headers: { "content-type": "text/html" } }),
      ),
    ).toBe("not an image");
    expect(await reason("/api/asset/x", () => "fail")).toBe("could not load");
    expect(await reason("data:image/png;base64,AA", () => image([1]))).toBe(
      "unsupported link",
    );
  });

  it("stops reading images over 10 MB", async () => {
    const declared = await run(
      "/api/asset/x",
      () =>
        new Response(new Uint8Array(1), {
          headers: {
            "content-type": "image/png",
            "content-length": String(MAX_IMAGE_BYTES + 1),
          },
        }),
    ).result;
    expect(declared).toMatchObject({ reason: "larger than 10 MB" });
    const streamed = await run("/api/asset/x", () =>
      image(new Uint8Array(MAX_IMAGE_BYTES + 1)),
    ).result;
    expect(streamed).toMatchObject({ reason: "larger than 10 MB" });
  });
});
