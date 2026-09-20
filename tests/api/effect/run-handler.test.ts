import { Data, Effect } from "effect";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { DatabaseError } from "../../../apps/api/src/effect/database";
import { NotFound } from "../../../apps/api/src/effect/errors";
import { runHandler } from "../../../apps/api/src/effect/run-handler";

class Boom extends Data.TaggedError("Boom")<{ readonly id: string }> {}

const toHttpException = (error: Boom) =>
  new HTTPException(404, { message: `boom ${error.id}` });

describe("runHandler", () => {
  it("resolves with the success value", async () => {
    await expect(runHandler(Effect.succeed(1), toHttpException)).resolves.toBe(
      1,
    );
  });

  it("maps a typed error to the module's HTTPException", async () => {
    const error = await runHandler(
      Effect.fail(new Boom({ id: "x" })),
      toHttpException,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HTTPException);
    expect(error).toMatchObject({ status: 404, message: "boom x" });
  });

  it("maps NotFound to a 404 with the entity message", async () => {
    const error = await runHandler(
      Effect.fail(new NotFound({ entity: "Task", id: "t1" })),
      toHttpException,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HTTPException);
    expect(error).toMatchObject({ status: 404, message: "Task not found" });
  });

  it("rethrows the cause of a DatabaseError unchanged", async () => {
    const cause = new Error("connection refused");

    await expect(
      runHandler(Effect.fail(new DatabaseError({ cause })), toHttpException),
    ).rejects.toBe(cause);
  });

  it("rethrows a defect unchanged", async () => {
    const defect = new TypeError("kaboom");

    await expect(runHandler(Effect.die(defect), toHttpException)).rejects.toBe(
      defect,
    );
  });

  it("rethrows an error thrown inside the effect unchanged", async () => {
    const thrown = new Error("thrown");

    await expect(
      runHandler(
        Effect.sync(() => {
          throw thrown;
        }),
        toHttpException,
      ),
    ).rejects.toBe(thrown);
  });
});
