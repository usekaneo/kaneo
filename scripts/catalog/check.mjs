#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { npmView } from "./npm-view.mjs";
import { runCheck } from "./run-check.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const program = runCheck(process.argv.slice(2), {
  indexPath: path.join(repoRoot, "catalog", "index.json"),
  npmView,
  sinks: {
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  },
}).pipe(
  Effect.flatMap((code) =>
    Effect.sync(() => {
      process.exitCode = code;
    }),
  ),
);

NodeRuntime.runMain(program, { disableErrorReporting: true });
