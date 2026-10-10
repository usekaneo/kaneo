import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { CatalogUnreadable, CheckFailed } from "./errors.mjs";
import {
  NOTHING_TO_CHECK,
  REMOTE_FAILED,
  checkReport,
  hasFailures,
  packageResult,
  pluginCount,
  renderPackageResult,
  renderProblems,
  renderValid,
} from "./report.mjs";
import { validateCatalog } from "./validate.mjs";

const REMOTE_CONCURRENCY = 4;

const readCatalog = (indexPath) =>
  Effect.tryPromise({
    try: async () => JSON.parse(await readFile(indexPath, "utf8")),
    catch: (error) =>
      new CatalogUnreadable({
        detail: error instanceof Error ? error.message : String(error),
      }),
  });

const remote = Flag.Boolean("remote").pipe(
  Flag.withDescription("Also check every listed package on npm"),
  Flag.withDefault(false),
);

const json = Flag.Boolean("json").pipe(
  Flag.withDescription("Print one JSON object on stdout"),
  Flag.withDefault(false),
);

export function makeCheckCommand({ indexPath, npmView, output }) {
  const print = (stream, lines) => output[stream](`${lines.join("\n")}\n`);

  const checkRemote = (plugins) =>
    Effect.forEach(
      plugins,
      (entry) =>
        npmView(entry.package).pipe(
          Effect.map((view) => packageResult(entry, view)),
        ),
      { concurrency: REMOTE_CONCURRENCY },
    );

  return Command.make("check.mjs", { remote, json }, (flags) =>
    Effect.gen(function* () {
      const catalog = yield* readCatalog(indexPath);
      const plugins = pluginCount(catalog);
      const problems = validateCatalog(catalog);
      if (problems.length > 0) {
        if (flags.json)
          yield* print("out", [
            JSON.stringify(checkReport({ plugins, problems })),
          ]);
        else yield* print("err", renderProblems(problems));
        return yield* Effect.fail(new CheckFailed());
      }

      if (!flags.remote) {
        yield* print("out", [
          flags.json
            ? JSON.stringify(checkReport({ plugins, problems }))
            : renderValid(plugins),
        ]);
        return;
      }

      if (!flags.json) yield* print("out", [renderValid(plugins)]);
      if (plugins === 0 && !flags.json) {
        yield* print("out", [NOTHING_TO_CHECK]);
        return;
      }

      const packages = yield* checkRemote(catalog.plugins);
      const failed = hasFailures(packages);
      if (flags.json) {
        yield* print("out", [
          JSON.stringify(checkReport({ plugins, problems, packages })),
        ]);
      } else {
        yield* print("out", packages.flatMap(renderPackageResult));
        if (failed) yield* print("err", ["", REMOTE_FAILED]);
      }
      if (failed) return yield* Effect.fail(new CheckFailed());
    }),
  ).pipe(
    Command.withDescription(
      "Check catalog/index.json, and with --remote every listed package on npm",
    ),
  );
}
