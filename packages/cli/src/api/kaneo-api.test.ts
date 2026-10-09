import { Effect, Fiber, Layer, Option, Result, Schema } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vite-plus/test";
import { emptyConfig, withProfile } from "../config/format.js";
import {
  fakeHttpClient,
  json,
  memoryConfigStore,
  type RecordedRequest,
  type Responder,
  testSession,
} from "../testing/test-layers.js";
import { KaneoApi, KaneoApiLayer } from "./kaneo-api.js";

const User = Schema.Struct({ id: Schema.String, name: Schema.String });

function run<A, E>(
  effect: Effect.Effect<A, E, KaneoApi>,
  respond: Responder,
  options: {
    session?: Parameters<typeof testSession>[0];
    store?: ReturnType<typeof memoryConfigStore>;
  } = {},
) {
  const recorded: RecordedRequest[] = [];
  const store = options.store ?? memoryConfigStore();
  const layer = KaneoApiLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        fakeHttpClient(respond, recorded),
        testSession(options.session),
        store.layer,
      ),
    ),
  );
  return {
    recorded,
    result: Effect.runPromise(
      Effect.result(effect.pipe(Effect.provide(layer))),
    ),
  };
}

const getUser = Effect.gen(function* () {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/user/me", User, {
    query: { a: 1, b: undefined },
  });
});

describe("KaneoApi", () => {
  it("sends the bearer token and decodes the body", async () => {
    const { recorded, result } = run(getUser, () =>
      json({ id: "u1", name: "Ada", extra: 1 }),
    );
    expect(await result).toEqual(Result.succeed({ id: "u1", name: "Ada" }));
    expect(recorded[0]).toMatchObject({
      method: "GET",
      url: "https://kaneo.test/api/user/me?a=1",
      authorization: "Bearer test-token",
    });
  });

  it("reports API drift as an unexpected response", async () => {
    const { result } = run(getUser, () => json({ id: 42 }));
    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure._tag).toBe(
      "UnexpectedResponse",
    );
  });

  it("maps JSON and text errors", async () => {
    const forbidden = await run(getUser, () =>
      json(
        {
          message: "Insufficient permissions",
          code: "MISSING_PERMISSION",
          missingPermissions: ["task:read"],
        },
        403,
      ),
    ).result;
    expect(Result.isFailure(forbidden) && forbidden.failure).toMatchObject({
      _tag: "PermissionDenied",
      missingPermissions: ["task:read"],
    });
    const missing = await run(
      getUser,
      () => new Response("Task not found", { status: 404 }),
    ).result;
    expect(Result.isFailure(missing) && missing.failure).toMatchObject({
      _tag: "NotFound",
      message: "Task not found",
    });
  });

  it("forgets an expired stored token", async () => {
    const store = memoryConfigStore(
      withProfile(emptyConfig, "default", () => ({
        apiUrl: "https://kaneo.test",
        token: "old",
      })),
    );
    const outcome = await run(
      getUser,
      () => new Response("Unauthorized", { status: 401 }),
      {
        store,
      },
    ).result;
    expect(Result.isFailure(outcome) && outcome.failure._tag).toBe(
      "SessionExpired",
    );
    expect(store.read().profiles.default?.token).toBeUndefined();
    expect(store.read().profiles.default?.apiUrl).toBe("https://kaneo.test");
  });

  it("keeps the login when a route answers 401 but the session still works", async () => {
    const store = memoryConfigStore(
      withProfile(emptyConfig, "default", () => ({
        apiUrl: "https://kaneo.test",
        token: "keep",
      })),
    );
    const removeMember = Effect.gen(function* () {
      const api = yield* KaneoApi;
      return yield* api.request(
        "POST",
        "/api/auth/organization/remove-member",
        Schema.Unknown,
        {
          body: {},
        },
      );
    });
    const outcome = await run(
      removeMember,
      (request) =>
        request.url.endsWith("/api/user/me")
          ? json({ id: "u1", name: "Ada" })
          : json({ message: "You are not allowed to delete this member" }, 401),
      { store },
    ).result;
    expect(Result.isFailure(outcome) && outcome.failure).toMatchObject({
      _tag: "PermissionDenied",
      message: "You are not allowed to delete this member",
    });
    expect(store.read().profiles.default?.token).toBe("keep");
  });

  it("treats a rejected API key as a credentials problem, not an expired login", async () => {
    const store = memoryConfigStore(
      withProfile(emptyConfig, "default", () => ({
        apiUrl: "https://kaneo.test",
        token: "keep",
      })),
    );
    const outcome = await run(
      getUser,
      () => new Response("Unauthorized", { status: 401 }),
      {
        store,
        session: { tokenSource: "env" },
      },
    ).result;
    expect(Result.isFailure(outcome) && outcome.failure._tag).toBe(
      "CredentialsRejected",
    );
    expect(store.read().profiles.default?.token).toBe("keep");
  });

  it("fails without credentials before sending anything", async () => {
    const { recorded, result } = run(getUser, () => json({}), {
      session: { credentials: Option.none() },
    });
    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure._tag).toBe(
      "NotSignedIn",
    );
    expect(recorded).toHaveLength(0);
  });

  it("retries a 429 after Retry-After", async () => {
    let calls = 0;
    const recorded: RecordedRequest[] = [];
    const layer = KaneoApiLayer.pipe(
      Layer.provide(
        Layer.mergeAll(
          fakeHttpClient(() => {
            calls += 1;
            return calls === 1
              ? new Response("Too many", {
                  status: 429,
                  headers: { "retry-after": "3" },
                })
              : json({ id: "u1", name: "Ada" });
          }, recorded),
          testSession(),
          memoryConfigStore().layer,
        ),
      ),
    );
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(getUser);
      yield* TestClock.adjust("2 seconds");
      expect(calls).toBe(1);
      yield* TestClock.adjust("2 seconds");
      return yield* Fiber.await(fiber);
    }).pipe(Effect.provide(Layer.merge(layer, TestClock.layer())));
    const exit = await Effect.runPromise(program);
    expect(exit._tag).toBe("Success");
    expect(calls).toBe(2);
  });

  it("does not wait for long Retry-After values", async () => {
    const { result } = run(
      getUser,
      () =>
        new Response("Too many", {
          status: 429,
          headers: { "retry-after": "120" },
        }),
    );
    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure).toMatchObject({
      _tag: "RateLimited",
      retryAfterSeconds: 120,
    });
  });
});
