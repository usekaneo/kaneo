import { Effect } from "effect";
import { Output } from "../output/output.js";
import type { Environment, StreamInfo } from "../render/capabilities.js";
import { CliEnvironment } from "../services/cli-environment.js";
import {
  detectImageProtocol,
  type ImageContext,
  type ImageProtocol,
  inTmux,
} from "./image-protocol.js";
import type { Rgb } from "./rgba.js";
import { terminalBackground } from "./terminal-background.js";

export type ImageTarget = {
  readonly protocol: ImageProtocol;
  readonly tmux: boolean;
  readonly level: 2 | 3;
  readonly background: Rgb | null;
};

export function resolveImageTarget(
  env: Environment,
  stream: StreamInfo,
  context: ImageContext,
): ImageTarget {
  const protocol = detectImageProtocol(env, stream, context);
  return {
    protocol,
    tmux: (protocol === "kitty" || protocol === "iterm") && inTmux(env),
    level: context.color === 2 ? 2 : 3,
    background: terminalBackground(env),
  };
}

export const currentImageTarget = Effect.gen(function* () {
  const output = yield* Output;
  const environment = yield* CliEnvironment;
  return resolveImageTarget(environment.env, environment.stdout, {
    json: output.mode === "json",
    color: output.ui.caps.color,
    unicode: output.ui.caps.unicode,
  });
});
