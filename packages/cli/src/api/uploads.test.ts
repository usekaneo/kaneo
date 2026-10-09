import { Effect, Layer, Result } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { describe, expect, it } from "vite-plus/test";
import {
  json,
  memoryConfigStore,
  testSession,
} from "../testing/test-layers.js";
import { KaneoApiLayer } from "./kaneo-api.js";
import { uploadTaskFile } from "./uploads.js";

type Sent = {
  readonly method: string;
  readonly url: string;
  readonly authorization: string | undefined;
  readonly contentType: string | undefined;
  readonly body: unknown;
};

const file = {
  name: "shot.png",
  bytes: new Uint8Array([137, 80, 78, 71]),
  contentType: "image/png",
};

function run(storageStatus = 200) {
  const sent: Sent[] = [];
  const client = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) =>
      Effect.sync(() => {
        const raw =
          request.body._tag === "Uint8Array" ? request.body.body : undefined;
        const isJson = request.headers["content-type"] === "application/json";
        sent.push({
          method: request.method,
          url: url.toString(),
          authorization: request.headers.authorization,
          contentType: request.headers["content-type"],
          body:
            raw && isJson
              ? JSON.parse(new TextDecoder().decode(raw))
              : raw && [...raw],
        });
        const response = url.hostname.startsWith("bucket")
          ? new Response(null, { status: storageStatus })
          : url.pathname.endsWith("/finalize")
            ? json({ id: "a1", url: "https://kaneo.test/api/asset/a1" })
            : json({
                key: "ws/p/t1/description/k.png",
                uploadUrl: "https://bucket.test/k.png?X-Amz-Signature=s",
                headers: { "Content-Type": "image/png" },
              });
        return HttpClientResponse.fromWeb(request, response);
      }),
    ),
  );
  const session = testSession();
  const layer = Layer.merge(
    KaneoApiLayer.pipe(
      Layer.provide(Layer.mergeAll(client, session, memoryConfigStore().layer)),
    ),
    Layer.merge(client, session),
  );
  const result = Effect.runPromise(
    Effect.result(
      uploadTaskFile("t1", file, "description").pipe(Effect.provide(layer)),
    ),
  );
  return { sent, result };
}

describe("uploadTaskFile", () => {
  it("asks for an upload URL, sends the bytes to storage, then finalizes", async () => {
    const { sent, result } = run();
    expect(await result).toEqual(
      Result.succeed({ id: "a1", url: "https://kaneo.test/api/asset/a1" }),
    );
    const details = {
      filename: "shot.png",
      contentType: "image/png",
      size: 4,
      surface: "description",
    };
    expect(sent).toEqual([
      {
        method: "PUT",
        url: "https://kaneo.test/api/task/image-upload/t1",
        authorization: "Bearer test-token",
        contentType: "application/json",
        body: details,
      },
      {
        method: "PUT",
        url: "https://bucket.test/k.png?X-Amz-Signature=s",
        authorization: undefined,
        contentType: "image/png",
        body: [137, 80, 78, 71],
      },
      {
        method: "POST",
        url: "https://kaneo.test/api/task/image-upload/t1/finalize",
        authorization: "Bearer test-token",
        contentType: "application/json",
        body: { key: "ws/p/t1/description/k.png", ...details },
      },
    ]);
  });

  it("fails without finalizing when storage rejects the bytes", async () => {
    const { sent, result } = run(403);
    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure._tag).toBe(
      "ServerError",
    );
    expect(sent).toHaveLength(2);
  });
});
