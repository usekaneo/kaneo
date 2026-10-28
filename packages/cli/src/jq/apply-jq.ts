import { Effect } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import type { JqFilter } from "./compile-jq.js";
import { formatJqResults } from "./format-jq-output.js";

export function toJsonValue(value: unknown): unknown {
  const text = JSON.stringify(value);
  return text === undefined ? null : JSON.parse(text);
}

export const applyJq = (filter: JqFilter, value: unknown) =>
  filter.run(toJsonValue(value)).pipe(
    Effect.map(formatJqResults),
    Effect.mapError(
      (detail) =>
        new InvalidArgument({
          message: `The --jq expression failed: ${detail}`,
          hint: "Run the same command with --json to see the data the expression receives.",
        }),
    ),
  );
