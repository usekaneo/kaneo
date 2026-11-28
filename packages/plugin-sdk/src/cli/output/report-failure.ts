import { Cause, Effect } from "effect";
import { CliError } from "effect/cli";
import { describeError, type Failure } from "../errors/describe.js";
import { isBuildError } from "../errors/is-build-error.js";
import type { OutputShape } from "./output.js";
import { renderError } from "./render-notice.js";
import type { Theme } from "./theme.js";

export type Outcome =
  | { readonly kind: "help"; readonly text: string }
  | { readonly kind: "interrupted" }
  | { readonly kind: "failure"; readonly failure: Failure };

export function classifyFailure(
  cause: Cause.Cause<unknown>,
  captured: string,
): Outcome {
  if (Cause.hasInterruptsOnly(cause)) return { kind: "interrupted" };
  const error = Cause.squash(cause);
  if (CliError.isCliError(error)) {
    if (error._tag === "ShowHelp") {
      const [first] = error.errors;
      if (!first) return { kind: "help", text: captured };
      return {
        kind: "failure",
        failure: {
          message: first.message,
          hint: `Run ${error.commandPath.join(" ")} --help to see the options.`,
        },
      };
    }
    return { kind: "failure", failure: { message: error.message, hint: null } };
  }
  if (isBuildError(error))
    return { kind: "failure", failure: describeError(error) };
  const message = error instanceof Error ? error.message : String(error);
  return {
    kind: "failure",
    failure: {
      message: `Unexpected error: ${message}`,
      hint: "Please report this at https://github.com/usekaneo/kaneo/issues",
    },
  };
}

export function renderFailure(theme: Theme, failure: Failure): string[] {
  const lines = [renderError(theme, failure.message)];
  if (failure.hint) lines.push(theme.dim(failure.hint));
  return lines;
}

export const reportOutcome = (
  output: OutputShape,
  outcome: Outcome,
): Effect.Effect<number> =>
  Effect.gen(function* () {
    if (outcome.kind === "help") {
      yield* output.out(outcome.text);
      return 0;
    }
    if (outcome.kind === "interrupted") {
      if (output.mode === "human") yield* output.err("\n");
      return 130;
    }
    if (output.mode === "json") {
      yield* output.out(
        `${JSON.stringify({ error: outcome.failure.message })}\n`,
      );
    } else {
      yield* output.err(
        `${renderFailure(output.errTheme, outcome.failure).join("\n")}\n`,
      );
    }
    return 1;
  });
