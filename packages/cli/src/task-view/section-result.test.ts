import { Effect, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { NotSignedIn, ServerError, SessionExpired } from "../errors/errors.js";
import {
  failed,
  loaded,
  mapSection,
  optionalSection,
  sectionValue,
} from "./section-result.js";

const run = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.result(effect));

describe("optionalSection", () => {
  it("wraps a loaded value", async () => {
    expect(await run(optionalSection(Effect.succeed([1, 2])))).toEqual(
      Result.succeed(loaded([1, 2])),
    );
  });

  it("turns other API failures into a failed section with the message", async () => {
    expect(
      await run(
        optionalSection(
          Effect.fail(new ServerError({ status: 502, message: "Bad gateway" })),
        ),
      ),
    ).toEqual(
      Result.succeed(failed("The server failed with 502: Bad gateway")),
    );
  });

  it("lets sign-in failures through", async () => {
    const apiUrl = "https://kaneo.test";
    for (const error of [
      new NotSignedIn({ apiUrl }),
      new SessionExpired({ apiUrl }),
    ]) {
      expect(await run(optionalSection(Effect.fail(error)))).toEqual(
        Result.fail(error),
      );
    }
  });
});

describe("mapSection and sectionValue", () => {
  it("map loaded values and keep failures", () => {
    expect(sectionValue(mapSection(loaded(2), (n) => n * 2))).toBe(4);
    expect(sectionValue(mapSection(failed<number>("x"), (n) => n * 2))).toBe(
      null,
    );
  });
});
