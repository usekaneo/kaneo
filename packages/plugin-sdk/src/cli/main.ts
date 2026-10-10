import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { processEnvironment } from "./environment.js";
import { processSinks } from "./output/output.js";
import { runCli } from "./run-cli.js";

export function main(argv: ReadonlyArray<string>): void {
  const program = runCli(argv, processEnvironment(), processSinks).pipe(
    Effect.flatMap((code) =>
      Effect.sync(() => {
        process.exitCode = code;
      }),
    ),
  );
  NodeRuntime.runMain(program, { disableErrorReporting: true });
}
