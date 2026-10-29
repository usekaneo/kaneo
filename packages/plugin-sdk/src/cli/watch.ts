import { Effect, Queue } from "effect";
import { attempt } from "./attempt.js";
import { describePlugin } from "./build-result.js";
import { emitTypes } from "./emit-types.js";
import { describeError } from "./errors/describe.js";
import type { PluginEntries } from "./entries.js";
import {
  followWatcher,
  isWatcher,
  type WatchTarget,
  type WatchUpdate,
} from "./follow-watcher.js";
import type { ViteConfig, ViteModule } from "./load-vite.js";
import type { PackageJson } from "./manifest.js";
import { createNodeConfig } from "./node-config.js";
import { Output } from "./output/output.js";
import { step, warn } from "./output/progress.js";
import { prepareBuild } from "./prepare-build.js";
import { renderWatchEvent, type WatchEvent } from "./watch-event.js";
import { createWebConfig } from "./web-config.js";

const report = Effect.fnUntraced(function* (event: WatchEvent) {
  const output = yield* Output;
  if (output.mode === "json") {
    yield* output.out(`${JSON.stringify(event)}\n`);
    return;
  }
  if (event.event === "error") {
    yield* output.err(`${renderWatchEvent(output.errTheme, event)}\n`);
    return;
  }
  yield* output.out(`${renderWatchEvent(output.theme, event)}\n`);
});

const startWatcher = (
  vite: ViteModule,
  config: ViteConfig,
  target: WatchTarget,
  updates: Queue.Queue<WatchUpdate>,
) =>
  Effect.acquireRelease(
    attempt(() => vite.build(config)),
    (watcher) =>
      isWatcher(watcher) && watcher.close
        ? attempt(async () => watcher.close?.()).pipe(Effect.ignore)
        : Effect.void,
  ).pipe(
    Effect.tap((watcher) =>
      Effect.sync(() => {
        if (isWatcher(watcher))
          followWatcher(watcher, target, (update) => {
            Queue.offerUnsafe(updates, update);
          });
      }),
    ),
  );

const finishUpdate = (
  root: string,
  entries: PluginEntries,
  packageJson: PackageJson,
  update: WatchUpdate,
) =>
  Effect.gen(function* () {
    const { target } = update;
    if (update.error !== null) {
      return yield* report({ event: "error", target, error: update.error });
    }
    if (target === "web") {
      return yield* report({ event: "built", target, warnings: [] });
    }
    const types = yield* attempt(() => emitTypes(root, entries, packageJson));
    yield* Effect.forEach(types.warnings, warn, { discard: true });
    yield* Effect.forEach(types.notes, step, { discard: true });
    yield* report({ event: "built", target, warnings: types.warnings });
  }).pipe(
    Effect.catch((error) =>
      report({
        event: "error",
        target: update.target,
        error: describeError(error).message,
      }),
    ),
  );

export const watchPlugin = Effect.fn("kaneo-plugin.watch")(function* (
  root: string,
) {
  const { manifest, entries, vite, flavor } = yield* prepareBuild(root);
  const updates = yield* Queue.unbounded<WatchUpdate>();

  yield* startWatcher(
    vite,
    createNodeConfig(root, entries, flavor, true),
    "node",
    updates,
  );
  if (entries.web) {
    yield* startWatcher(
      vite,
      createWebConfig(root, entries.web, flavor, true),
      "web",
      updates,
    );
  }

  yield* report({ event: "watching", plugin: describePlugin(manifest.plugin) });
  return yield* Effect.forever(
    Queue.take(updates).pipe(
      Effect.flatMap((update) =>
        finishUpdate(root, entries, manifest.packageJson, update),
      ),
    ),
  );
}, Effect.scoped);
