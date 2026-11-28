import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { attempt, attemptSync } from "./attempt.js";
import { findEntries } from "./entries.js";
import { describeVite, loadVite } from "./load-vite.js";
import { readManifest } from "./manifest.js";

export const prepareBuild = Effect.fnUntraced(function* (root: string) {
  const manifest = yield* attempt(() => readManifest(root));
  const entries = yield* attemptSync(() => findEntries(root));
  const vite = yield* attempt(() => loadVite(root));
  const flavor = yield* attemptSync(() => describeVite(vite));
  yield* attempt(() =>
    rm(join(root, "dist"), { recursive: true, force: true }),
  );
  return { manifest, entries, vite, flavor };
});
