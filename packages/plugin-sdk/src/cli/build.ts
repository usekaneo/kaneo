import { relative } from "node:path";
import { Effect } from "effect";
import { attempt } from "./attempt.js";
import { type BuildResult, describePlugin } from "./build-result.js";
import { listBuiltFiles } from "./built-files.js";
import { checkOutputs } from "./check-outputs.js";
import { emitTypes } from "./emit-types.js";
import { InvalidOutput } from "./errors/errors.js";
import { createNodeConfig } from "./node-config.js";
import { step, warn } from "./output/progress.js";
import { prepareBuild } from "./prepare-build.js";
import { createWebConfig } from "./web-config.js";

export const buildPlugin = Effect.fn("kaneo-plugin.build")(function* (
  root: string,
) {
  const { manifest, entries, vite, flavor } = yield* prepareBuild(root);
  const nodeInputs = [entries.index, entries.server]
    .filter((entry): entry is string => entry !== null)
    .map((entry) => relative(root, entry));

  yield* step(`Building ${nodeInputs.join(" and ")} for Node`);
  yield* attempt(() =>
    vite.build(createNodeConfig(root, entries, flavor, false)),
  );

  const web = entries.web;
  if (web) {
    yield* step(`Building ${relative(root, web)} for the browser`);
    yield* attempt(() => vite.build(createWebConfig(root, web, flavor, false)));
  }

  yield* step("Generating dist/index.d.ts");
  const types = yield* attempt(() =>
    emitTypes(root, entries, manifest.packageJson),
  );
  yield* Effect.forEach(types.warnings, warn, { discard: true });
  yield* Effect.forEach(types.notes, step, { discard: true });

  const issues = yield* attempt(() =>
    checkOutputs(root, manifest, entries, types.emitted),
  );
  yield* Effect.forEach(issues.warnings, warn, { discard: true });
  if (issues.errors.length > 0)
    return yield* Effect.fail(new InvalidOutput({ problems: issues.errors }));

  const files = yield* attempt(() => listBuiltFiles(root));
  const result: BuildResult = {
    plugin: describePlugin(manifest.plugin),
    files,
    warnings: [...types.warnings, ...issues.warnings],
  };
  return result;
});
