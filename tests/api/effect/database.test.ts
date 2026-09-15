import { Context, Data, Effect } from "effect";
import { describe, expect, it } from "vitest";
import { Database, DatabaseError } from "../../../apps/api/src/effect/database";
import { makeTestDatabase } from "../../../apps/api/src/effect/testing";

class NotFound extends Data.TaggedError("NotFound")<{
  readonly id: string;
}> {}

class Greeting extends Context.Service<Greeting, string>()("test/Greeting") {}

function failureOf(effect: Effect.Effect<unknown, unknown>) {
  return Effect.runPromise(effect).then(
    () => {
      throw new Error("expected the effect to fail");
    },
    (error: unknown) => error,
  );
}

function makeTransactionalClient(options: { failCommit?: Error } = {}) {
  const trace: string[] = [];
  const handle = { name: "tx" };
  const client = {
    transaction: async (body: (tx: unknown) => Promise<unknown>) => {
      trace.push("begin");
      try {
        const result = await body(handle);
        if (options.failCommit) {
          throw options.failCommit;
        }
        trace.push("commit");
        return result;
      } catch (error) {
        trace.push("rollback");
        throw error;
      }
    },
  };
  return { client, trace, handle };
}

describe("Database service", () => {
  it("query wraps a rejected client call in DatabaseError with its cause", async () => {
    const cause = new Error("connection refused");
    const layer = makeTestDatabase({ select: () => Promise.reject(cause) });

    const program = Effect.gen(function* () {
      const database = yield* Database;
      return yield* database.query((client) => client.select());
    });

    const error = await failureOf(Effect.provide(program, layer));

    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).cause).toBe(cause);
  });

  it("transaction hands the body the transaction handle and commits", async () => {
    const { client, trace, handle } = makeTransactionalClient();

    const program = Effect.gen(function* () {
      const database = yield* Database;
      return yield* database.transaction((tx) =>
        tx.query((c) => Promise.resolve(c === handle)),
      );
    });

    await expect(
      Effect.runPromise(Effect.provide(program, makeTestDatabase(client))),
    ).resolves.toBe(true);
    expect(trace).toEqual(["begin", "commit"]);
  });

  it("transaction rolls back on a typed failure and surfaces the same error", async () => {
    const { client, trace } = makeTransactionalClient();

    const program = Effect.gen(function* () {
      const database = yield* Database;
      return yield* database.transaction(() =>
        Effect.fail(new NotFound({ id: "x" })),
      );
    });

    const error = await failureOf(
      Effect.provide(program, makeTestDatabase(client)),
    );

    expect(error).toBeInstanceOf(NotFound);
    expect((error as NotFound).id).toBe("x");
    expect(trace).toEqual(["begin", "rollback"]);
  });

  it("transaction failures can be recovered with catchTag outside the transaction", async () => {
    const { client } = makeTransactionalClient();

    const program = Effect.gen(function* () {
      const database = yield* Database;
      return yield* database.transaction(() =>
        Effect.fail(new NotFound({ id: "x" })),
      );
    }).pipe(Effect.catchTag("NotFound", (error) => Effect.succeed(error.id)));

    await expect(
      Effect.runPromise(Effect.provide(program, makeTestDatabase(client))),
    ).resolves.toBe("x");
  });

  it("transaction rolls back on a defect and rethrows the same defect", async () => {
    const { client, trace } = makeTransactionalClient();
    const defect = new TypeError("kaboom");

    const program = Effect.gen(function* () {
      const database = yield* Database;
      return yield* database.transaction(() => Effect.die(defect));
    });

    await expect(
      Effect.runPromise(Effect.provide(program, makeTestDatabase(client))),
    ).rejects.toBe(defect);
    expect(trace).toEqual(["begin", "rollback"]);
  });

  it("transaction reports a failed commit as DatabaseError", async () => {
    const commitError = new Error("commit failed");
    const { client } = makeTransactionalClient({ failCommit: commitError });

    const program = Effect.gen(function* () {
      const database = yield* Database;
      return yield* database.transaction(() => Effect.succeed("done"));
    });

    const error = await failureOf(
      Effect.provide(program, makeTestDatabase(client)),
    );

    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).cause).toBe(commitError);
  });

  it("transaction bodies see services provided to the outer effect", async () => {
    const { client } = makeTransactionalClient();

    const program = Effect.gen(function* () {
      const database = yield* Database;
      return yield* database.transaction(() => Greeting);
    });

    await expect(
      Effect.runPromise(
        program.pipe(
          Effect.provide(makeTestDatabase(client)),
          Effect.provideService(Greeting, "hello"),
        ),
      ),
    ).resolves.toBe("hello");
  });
});
