# Effect migration recipe

Status: pilot complete for `apps/api/src/label` on `effect@4.0.0-rc.115`
(an RC, pinned exactly on purpose). The HTTP contract, OpenAPI output, events,
and provider sync calls are unchanged; the existing label tests run through
the new boundary with their assertions untouched, and new tests exercise the
controllers through in-memory test layers.

## The seam (`apps/api/src/effect/`)

| File | Purpose |
| --- | --- |
| `database.ts` | `Database` service. `query(fn)` wraps any Drizzle call into `Effect<A, DatabaseError>`. `transaction(body)` runs an Effect body inside `db.transaction`; typed failures and defects roll back and resurface unchanged. `DrizzleClient` is the common supertype of the root client and a transaction handle. |
| `events.ts` | `Events` service with `publish(type, data)`. |
| `live.ts` | `DatabaseLive` and `EventsLive`, built with `Layer.succeed` from the existing `db` and `publishEvent` singletons. |
| `run-handler.ts` | `runHandler(effect, toHttpException)`: the only place an Effect is run. Typed errors become the module's `HTTPException`; a `DatabaseError` rethrows its cause and a defect is rethrown as is, so Hono's `onError` still produces the same JSON 500 and Sentry capture. |
| `testing.ts` | `makeTestDatabase(fakeClient)` and `makeTestEvents()` for unit tests without `vi.mock`. |

Only `Layer.succeed` layers are used. In rc.115 `Effect.provide(layer)`
rebuilds a `Layer.effect` on every call and a lazily built layer leaks
`AsyncLocalStorage` context across requests during its first build, so keep
per-process resources out of layer constructors.

## Migrating the next module, step by step

1. Read every controller and note each `throw new HTTPException(status, { message })`,
   each plain `throw new Error(...)`, each `publishEvent(...)`, and each
   fire-and-forget call.
2. Create `<module>/errors.ts`: one `Data.TaggedError` per distinct failure,
   carrying the data the error needs, and a `<module>ErrorToHttpException`
   switch that returns the exact status and message the controller threw
   before. End the switch with `default: return error satisfies never` so a
   new error cannot be left unmapped.
3. Wrap other ambient singletons the controllers call as module-local
   services (the label module has `label-sync.ts` for the GitHub and Gitea
   helpers). Keep the tag in its own file so controllers never import the
   Live implementation.
4. Rewrite each controller as `Effect.fn("<module>.<name>")(function* (...) {})`:
   - `const database = yield* Database;` then `yield* database.query((db) => ...)`
     around each Drizzle call, keeping the query text identical.
   - `db.transaction(async (tx) => ...)` becomes
     `database.transaction((tx) => Effect.gen(function* () { ... }))` with
     `tx.query(...)` inside.
   - `throw new HTTPException(...)` becomes `return yield* new SomeError({...})`.
   - A plain `throw new Error(...)` that previously produced a JSON 500 becomes
     `return yield* Effect.die(new Error(...))`.
   - `await publishEvent(type, data)` becomes `yield* events.publish(type, data)`.
   - Fire-and-forget calls go through the module service, which wraps the
     original call and its `.catch` logging unchanged.
   - Capture narrowed nullable fields into a `const` before using them inside
     a `query` callback; TypeScript does not keep property narrowing inside
     closures.
5. Create `<module>/runtime.ts` with the module's Live layers merged into one
   layer and a `run<Module>` helper that calls `runHandler` with the mapper.
6. In `<module>/index.ts` change only the handler bodies:
   `c.json(await run<Module>(controller(...)), 200)`. Route definitions,
   schemas, and middleware stay untouched.
7. Existing unit tests keep their mocks and assertions; replace the controller
   import with a local wrapper that calls `run<Module>(controllerEffect(...))`.
   Add tests through `makeTestDatabase`, `makeTestEvents`, and a recording
   layer for the module service.
8. Verify: `pnpm --filter @kaneo/api typecheck`, `pnpm --filter @kaneo/api test`,
   the module's integration tests, `pnpm openapi:check`, and
   `pnpm exec biome ci <changed paths>`.

## Behaviour-preservation table

| Before | After | HTTP result |
| --- | --- | --- |
| `throw new HTTPException(s, { message })` | tagged error + mapper entry | same status, same text/plain message |
| `throw new Error(...)` | `Effect.die(new Error(...))` | JSON 500, same Sentry capture |
| Drizzle rejection | `DatabaseError` with `cause` | boundary rethrows the cause: JSON 500 |
| `await publishEvent(...)` rejects | defect | JSON 500 |
| `.catch(console.error)` fire-and-forget | same call inside a service method | unchanged |

## Effect v4 notes verified against rc.115

- Services are `class X extends Context.Service<X, Shape>()("id") {}`. There
  is no `ServiceMap`, `Effect.Service`, or `Context.Tag` in this RC.
- `Effect.catchAll` is `Effect.catch`; `Either` is `Result`; `Cause.hasDie`
  is `Cause.hasDies`.
- `Effect.runPromise` rejects with the raw typed error or the raw defect, never
  a wrapper. `Effect.runPromiseExit` never rejects; use
  `Cause.findErrorOption` and `Cause.squash`.
- `Effect.tryPromise(thunk)` fails with `Cause.UnknownError`; use the
  `{ try, catch }` form for a typed error.
- A `Data.TaggedError` with no fields is constructed as `new X()`, not `new X({})`.
- Independent fibers keep `AsyncLocalStorage` context, so `initiatorId` in
  `publishEvent` still works. Effect primitives shared across requests
  (`Semaphore`, `Deferred`, `Latch`, lazily built layers) resume waiters in
  another request's context. Do not introduce one without capturing the store
  at the boundary and wrapping `publishEvent` in `eventContext.run(store, ...)`.
- The workspace override is `'effect@<4.0.0-0': '>=3.20.0'`; a bare `effect`
  key would rewrite the v4 pin to 3.x. Regenerate the lockfile whenever the
  override block changes or CI's frozen install fails.

## What did not fit the pattern

- The brief listed two services; the label module needed a third,
  `LabelSync`, because the GitHub and Gitea helpers import the database
  singleton and would defeat the test layers.
- `EventsLive` awaits `publishEvent` inside an `async` thunk rather than
  returning its promise, matching the original `await` semantics (the
  existing tests mock `publishEvent` with a bare `vi.fn()`).
- Request abort is not wired to fiber interruption. `runHandler` could pass
  `c.req.raw.signal` as `RunOptions.signal` later; a transaction body is not
  interruption-linked to the outer fiber without it.
- `Effect.fn` span names reach `Cause.pretty` and `Effect.currentSpan` only;
  no tracer exports them yet.
- Observed but untouched: delete and detach only sync GitHub while attach and
  the cascade sync both providers; the `hono: '>=4.12.25'` override rewrites
  the API's `^4.13.0` to 4.12.34.

## Proposed later phases

1. Migrate `time-entry`, `external-link`, and `comment` with this recipe.
2. Carry `initiatorId` as a request-scoped service instead of reading
   `AsyncLocalStorage` inside `publishEvent`.
3. Wire request abort to fiber interruption and consider a `ManagedRuntime`
   once a layer needs resources.
4. Evaluate `@effect/platform` HTTP and Effect `Schema` only after several
   modules share the seam.
