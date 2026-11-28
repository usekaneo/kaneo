import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { buildPlugin } from "./build.js";
import { CliEnvironment } from "./environment.js";
import { emit } from "./output/emit.js";
import { renderSummary } from "./render-summary.js";
import { watchPlugin } from "./watch.js";

const watch = Flag.Boolean("watch").pipe(
  Flag.withAlias("w"),
  Flag.withDescription("Rebuild when files change"),
  Flag.withDefault(false),
);

export const buildCommand = Command.make("build", { watch }, (flags) =>
  Effect.gen(function* () {
    const { cwd } = yield* CliEnvironment;
    if (flags.watch) return yield* watchPlugin(cwd);
    yield* emit(yield* buildPlugin(cwd), renderSummary);
  }),
).pipe(
  Command.withDescription(
    "Build the Kaneo plugin in the current folder into dist/",
  ),
);
