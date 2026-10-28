import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Layer } from "effect";
import { CliConfig, CliOutput, Command, GlobalFlag } from "effect/cli";
import packageJson from "../package.json" with { type: "json" };
import { makeFormatter } from "./cli/formatter.js";
import { root } from "./cli/root.js";
import { ConfigStoreLive } from "./config/config-store.js";
import { exitOnClosedPipe } from "./output/exit-on-closed-pipe.js";
import { layerOutput, makeOutput, processSinks } from "./output/output.js";
import { resolveOutputMode } from "./output/output-mode.js";
import { classifyFailure, reportOutcome } from "./output/report-failure.js";
import {
  CliEnvironment,
  processEnvironment,
} from "./services/cli-environment.js";
import { DesktopLive } from "./services/desktop.js";
import { DeviceAuthLive } from "./services/device-auth.js";

function capturingConsole(lines: string[]): Console.Console {
  const push = (...args: ReadonlyArray<unknown>) => {
    lines.push(args.map(String).join(" "));
  };
  return Object.assign(Object.create(globalThis.console), {
    log: push,
    info: push,
    warn: push,
    error: push,
    debug: () => {},
  });
}

export function main(argv: ReadonlyArray<string>): void {
  exitOnClosedPipe([process.stdout, process.stderr]);
  const environment = processEnvironment();
  const mode = resolveOutputMode(
    argv,
    environment.env,
    environment.stdout.isTTY,
  );
  const output = makeOutput(mode, environment, processSinks);
  const captured: string[] = [];
  const flush = () => (captured.length > 0 ? `${captured.join("\n")}\n` : "");

  const environmentLayer = Layer.succeed(CliEnvironment, environment);
  const services = Layer.mergeAll(
    layerOutput(output),
    environmentLayer,
    ConfigStoreLive,
    DesktopLive,
    DeviceAuthLive,
    CliOutput.layer(makeFormatter(output)),
    CliConfig.layer({
      builtIns: [GlobalFlag.Help, GlobalFlag.Version, GlobalFlag.Completions],
    }),
    NodeServices.layer,
  ).pipe(Layer.provide(environmentLayer));

  const program = Command.runWith(root, {
    version: packageJson.version,
    renderErrors: false,
  })(argv).pipe(
    Effect.provideService(Console.Console, capturingConsole(captured)),
    Effect.matchCauseEffect({
      onSuccess: () => output.out(flush()),
      onFailure: (cause) =>
        reportOutcome(output, classifyFailure(cause, flush())),
    }),
    Effect.provide(services),
  );

  NodeRuntime.runMain(program, { disableErrorReporting: true });
}
