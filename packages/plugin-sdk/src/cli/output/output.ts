import { Context, Effect, Layer } from "effect";
import type { CliEnvironmentShape } from "../environment.js";
import { detectColor } from "./detect-color.js";
import type { OutputMode } from "./output-mode.js";
import { makeTheme, type Theme } from "./theme.js";

export type OutputShape = {
  readonly mode: OutputMode;
  readonly theme: Theme;
  readonly errTheme: Theme;
  readonly out: (text: string) => Effect.Effect<void>;
  readonly err: (text: string) => Effect.Effect<void>;
};

export class Output extends Context.Service<Output, OutputShape>()(
  "kaneo-plugin/Output",
) {}

export type OutputSinks = {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
};

export const processSinks: OutputSinks = {
  out: (text) => {
    process.stdout.write(text);
  },
  err: (text) => {
    process.stderr.write(text);
  },
};

export function makeOutput(
  mode: OutputMode,
  environment: CliEnvironmentShape,
  sinks: OutputSinks,
): OutputShape {
  const theme = (isTTY: boolean) =>
    makeTheme(mode === "human" && detectColor(environment.env, isTTY));
  return {
    mode,
    theme: theme(environment.stdout.isTTY),
    errTheme: theme(environment.stderr.isTTY),
    out: (text) => Effect.sync(() => sinks.out(text)),
    err: (text) => Effect.sync(() => sinks.err(text)),
  };
}

export const layerOutput = (output: OutputShape) =>
  Layer.succeed(Output, output);
