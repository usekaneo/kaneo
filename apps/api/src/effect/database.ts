import { type Cause, Context, Data, Effect, Exit } from "effect";
import type { DrizzleClient } from "../database/client";

export type { DrizzleClient };

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

export type DatabaseExecutor = {
  readonly query: <A>(
    run: (client: DrizzleClient) => PromiseLike<A>,
  ) => Effect.Effect<A, DatabaseError>;
};

export type DatabaseShape = DatabaseExecutor & {
  readonly transaction: <A, E, R>(
    body: (tx: DatabaseExecutor) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | DatabaseError, R>;
};

export class Database extends Context.Service<Database, DatabaseShape>()(
  "kaneo/Database",
) {}

function makeExecutor(client: DrizzleClient): DatabaseExecutor {
  return {
    query: (run) =>
      Effect.tryPromise({
        try: () => run(client),
        catch: (cause) => new DatabaseError({ cause }),
      }),
  };
}

// Thrown out of the Drizzle transaction callback so Drizzle rolls back, then
// unwrapped again so the outer effect fails with the body's own cause.
class TransactionRollback {
  constructor(readonly cause: Cause.Cause<unknown>) {}
}

export function makeDatabase(client: DrizzleClient): DatabaseShape {
  return {
    ...makeExecutor(client),
    transaction: <A, E, R>(
      body: (tx: DatabaseExecutor) => Effect.Effect<A, E, R>,
    ) =>
      Effect.gen(function* () {
        const services = yield* Effect.context<R>();
        const runBody = Effect.runPromiseExitWith(services);
        const exit = yield* Effect.promise(() =>
          client
            .transaction(async (tx) => {
              const inner = await runBody(body(makeExecutor(tx)));
              if (Exit.isFailure(inner)) {
                throw new TransactionRollback(inner.cause);
              }
              return inner;
            })
            .then(
              (inner): Exit.Exit<A, E | DatabaseError> => inner,
              (error: unknown): Exit.Exit<A, E | DatabaseError> =>
                error instanceof TransactionRollback
                  ? Exit.failCause(error.cause as Cause.Cause<E>)
                  : Exit.fail(new DatabaseError({ cause: error })),
            ),
        );
        return yield* exit;
      }),
  };
}
