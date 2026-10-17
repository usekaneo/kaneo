import { Effect, Fiber, Layer, Result, Schema } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vite-plus/test";
import { KaneoApi } from "../api/kaneo-api.js";
import { RateLimited } from "../errors/errors.js";
import { deleteLabelFully } from "./delete-label-fully.js";

type Reply =
  | { readonly status: 200 | 202 }
  | { readonly status: 429; readonly retryAfter: number | null };

function scripted(replies: ReadonlyArray<Reply>) {
  const calls: Array<{ method: string; path: string; at: number }> = [];
  let index = 0;
  const layer = Layer.succeed(KaneoApi, {
    request: (method, path, schema) =>
      Effect.gen(function* () {
        const at = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
        calls.push({ method, path, at });
        const reply = replies[Math.min(index, replies.length - 1)] ?? {
          status: 200,
        };
        index += 1;
        if (reply.status === 429) {
          return yield* new RateLimited({
            retryAfterSeconds: reply.retryAfter,
          });
        }
        return yield* Schema.decodeUnknownEffect(schema)({
          id: "l_bug",
          name: "Bug",
          ...(reply.status === 202 ? { pendingDeletion: true } : {}),
        }).pipe(Effect.orDie);
      }),
  });
  return { layer, calls };
}

const run = (layer: Layer.Layer<KaneoApi>, advance: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        Effect.result(deleteLabelFully("l_bug")),
      );
      yield* TestClock.adjust(advance as "1 second");
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(Layer.merge(layer, TestClock.layer()))),
  );

describe("deleteLabelFully", () => {
  it("repeats the DELETE after 202 until the server answers 200", async () => {
    const api = scripted([{ status: 202 }, { status: 202 }, { status: 200 }]);
    const result = await run(api.layer, "1 second");
    expect(result).toEqual(Result.succeed({ id: "l_bug", name: "Bug" }));
    expect(api.calls).toEqual([
      { method: "DELETE", path: "/api/label/l_bug", at: 0 },
      { method: "DELETE", path: "/api/label/l_bug", at: 0 },
      { method: "DELETE", path: "/api/label/l_bug", at: 0 },
    ]);
  });

  it("sleeps for Retry-After when the deletion lock is busy", async () => {
    const api = scripted([
      { status: 202 },
      { status: 429, retryAfter: 20 },
      { status: 429, retryAfter: null },
      { status: 200 },
    ]);
    const result = await run(api.layer, "30 seconds");
    expect(Result.isSuccess(result)).toBe(true);
    expect(api.calls.map((call) => call.at)).toEqual([0, 0, 20_000, 21_000]);
  });

  it("gives up after about a minute of waiting", async () => {
    const api = scripted([{ status: 429, retryAfter: 30 }]);
    const result = await run(api.layer, "5 minutes");
    expect(Result.isFailure(result) && result.failure._tag).toBe("RateLimited");
    expect(api.calls.map((call) => call.at)).toEqual([0, 30_000, 60_000]);
  });
});
