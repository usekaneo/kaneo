import { Effect } from "effect";
import { CliError } from "effect/cli";
import { compileJq } from "./compile-jq.js";

export const jqFlagValue = (expression: string) =>
  compileJq(expression).pipe(
    Effect.mapError(
      (detail) =>
        new CliError.InvalidValue({
          option: "jq",
          value: expression,
          expected: `a jq expression (${detail})`,
          kind: "flag",
        }),
    ),
  );
