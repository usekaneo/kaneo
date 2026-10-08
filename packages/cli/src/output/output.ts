import { Context, Effect, Layer } from "effect";
import {
  type Capabilities,
  detectCapabilities,
  plainCapabilities,
} from "../render/capabilities.js";
import { makeUi, type Ui } from "../render/ui.js";
import type { CliEnvironmentShape } from "../services/cli-environment.js";
import type { OutputMode } from "./output-mode.js";

export type OutputShape = {
  readonly mode: OutputMode;
  readonly ui: Ui;
  readonly errUi: Ui;
  readonly interactive: boolean;
  readonly out: (text: string) => Effect.Effect<void>;
  readonly err: (text: string) => Effect.Effect<void>;
};

export class Output extends Context.Service<Output, OutputShape>()(
  "kaneo/Output",
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
  const capabilities = (stream: CliEnvironmentShape["stdout"]): Capabilities =>
    mode === "json"
      ? { ...plainCapabilities, columns: stream.columns ?? 80 }
      : detectCapabilities(environment.env, stream, environment.platform);
  return {
    mode,
    ui: makeUi(capabilities(environment.stdout)),
    errUi: makeUi(capabilities(environment.stderr)),
    interactive:
      mode === "human" && environment.stdin.isTTY && environment.stdout.isTTY,
    out: (text) => Effect.sync(() => sinks.out(text)),
    err: (text) => Effect.sync(() => sinks.err(text)),
  };
}

export const layerOutput = (output: OutputShape) =>
  Layer.succeed(Output, output);
