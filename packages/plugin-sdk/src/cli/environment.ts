import { Context } from "effect";

export type Environment = Readonly<Record<string, string | undefined>>;

export type CliEnvironmentShape = {
  readonly env: Environment;
  readonly cwd: string;
  readonly stdout: { readonly isTTY: boolean };
  readonly stderr: { readonly isTTY: boolean };
};

export class CliEnvironment extends Context.Service<
  CliEnvironment,
  CliEnvironmentShape
>()("kaneo-plugin/CliEnvironment") {}

export function processEnvironment(): CliEnvironmentShape {
  return {
    env: process.env,
    cwd: process.cwd(),
    stdout: { isTTY: process.stdout.isTTY === true },
    stderr: { isTTY: process.stderr.isTTY === true },
  };
}
