import * as NodeServices from "@effect/platform-node/NodeServices";
import { Cause, Console, Effect, Layer } from "effect";
import {
  CliConfig,
  CliError,
  CliOutput,
  Command,
  GlobalFlag,
} from "effect/cli";
import packageJson from "../../package.json" with { type: "json" };
import { makeCheckCommand } from "./command.mjs";

function capturingConsole(lines) {
  const push = (...args) => {
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

function failureMessage(error) {
  if (error?._tag === "CatalogUnreadable") {
    return `catalog/index.json could not be read: ${error.detail}`;
  }
  if (CliError.isCliError(error)) {
    return error._tag === "ShowHelp" && error.errors[0]
      ? error.errors[0].message
      : error.message;
  }
  return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}

const reportFailure = (output, json, cause, captured) => {
  if (Cause.hasInterruptsOnly(cause)) return Effect.succeed(130);
  const error = Cause.squash(cause);
  if (error?._tag === "CheckFailed") return Effect.succeed(1);
  if (
    CliError.isCliError(error) &&
    error._tag === "ShowHelp" &&
    error.errors.length === 0
  ) {
    return output.out(captured).pipe(Effect.as(0));
  }
  const message = failureMessage(error);
  return (
    json
      ? output.out(`${JSON.stringify({ error: message })}\n`)
      : output.err(`${message}\n`)
  ).pipe(Effect.as(1));
};

export function runCheck(argv, { indexPath, npmView, sinks }) {
  const end = argv.indexOf("--");
  const json = (end === -1 ? argv : argv.slice(0, end)).includes("--json");
  const output = {
    out: (text) => Effect.sync(() => sinks.out(text)),
    err: (text) => Effect.sync(() => sinks.err(text)),
  };
  const captured = [];
  const flush = () => (captured.length > 0 ? `${captured.join("\n")}\n` : "");

  const services = Layer.mergeAll(
    CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
    CliConfig.layer({ builtIns: [GlobalFlag.Help] }),
    NodeServices.layer,
  );

  return Command.runWith(makeCheckCommand({ indexPath, npmView, output }), {
    version: packageJson.version,
    renderErrors: false,
  })(argv).pipe(
    Effect.provideService(Console.Console, capturingConsole(captured)),
    Effect.matchCauseEffect({
      onSuccess: () => output.out(flush()).pipe(Effect.as(0)),
      onFailure: (cause) => reportFailure(output, json, cause, flush()),
    }),
    Effect.provide(services),
  );
}
