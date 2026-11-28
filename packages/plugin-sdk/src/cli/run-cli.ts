import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Layer } from "effect";
import { CliConfig, CliOutput, Command, GlobalFlag } from "effect/cli";
import packageJson from "../../package.json" with { type: "json" };
import { CliEnvironment, type CliEnvironmentShape } from "./environment.js";
import { makeFormatter } from "./formatter.js";
import { capturingConsole } from "./output/capturing-console.js";
import { layerOutput, makeOutput, type OutputSinks } from "./output/output.js";
import { resolveOutputMode } from "./output/output-mode.js";
import { classifyFailure, reportOutcome } from "./output/report-failure.js";
import { root } from "./root.js";

export function runCli(
  argv: ReadonlyArray<string>,
  environment: CliEnvironmentShape,
  sinks: OutputSinks,
): Effect.Effect<number> {
  const mode = resolveOutputMode(
    argv,
    environment.env,
    environment.stdout.isTTY,
  );
  const output = makeOutput(mode, environment, sinks);
  const captured: string[] = [];
  const flush = () => (captured.length > 0 ? `${captured.join("\n")}\n` : "");

  const services = Layer.mergeAll(
    layerOutput(output),
    Layer.succeed(CliEnvironment, environment),
    CliOutput.layer(makeFormatter(output)),
    CliConfig.layer({ builtIns: [GlobalFlag.Help, GlobalFlag.Version] }),
    NodeServices.layer,
  );

  return Command.runWith(root, {
    version: packageJson.version,
    renderErrors: false,
  })(argv).pipe(
    Effect.provideService(Console.Console, capturingConsole(captured)),
    Effect.matchCauseEffect({
      onSuccess: () => output.out(flush()).pipe(Effect.as(0)),
      onFailure: (cause) =>
        reportOutcome(output, classifyFailure(cause, flush())),
    }),
    Effect.provide(services),
  );
}
