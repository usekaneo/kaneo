import { homedir } from "node:os";
import { Context, Layer } from "effect";
import type { Environment, StreamInfo } from "../render/capabilities.js";

export type CliEnvironmentShape = {
  readonly env: Environment;
  readonly cwd: string;
  readonly home: string;
  readonly platform: string;
  readonly stdin: StreamInfo;
  readonly stdout: StreamInfo;
  readonly stderr: StreamInfo;
};

export class CliEnvironment extends Context.Service<
  CliEnvironment,
  CliEnvironmentShape
>()("kaneo/CliEnvironment") {}

export function processEnvironment(): CliEnvironmentShape {
  return {
    env: process.env,
    cwd: process.cwd(),
    home: homedir(),
    platform: process.platform,
    stdin: { isTTY: process.stdin.isTTY === true, columns: undefined },
    stdout: {
      isTTY: process.stdout.isTTY === true,
      columns: process.stdout.columns,
    },
    stderr: {
      isTTY: process.stderr.isTTY === true,
      columns: process.stderr.columns,
    },
  };
}

export const CliEnvironmentLive = Layer.sync(
  CliEnvironment,
  processEnvironment,
);
