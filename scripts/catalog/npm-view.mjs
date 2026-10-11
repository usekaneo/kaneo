import { Effect, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { readNpmView } from "./npm-checks.mjs";

const collect = (stream) => Stream.mkString(Stream.decodeText(stream));

function failureMessage(packageName, stderr) {
  return [`Command failed: npm view ${packageName} --json`, stderr.trim()]
    .filter(Boolean)
    .join("\n");
}

export const npmView = (packageName) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(
        "npm",
        ["view", packageName, "--json"],
        { shell: process.platform === "win32" },
      );
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collect(handle.stdout), collect(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" },
      );
      return exitCode === 0
        ? readNpmView(stdout)
        : readNpmView(stdout, failureMessage(packageName, stderr));
    }),
  ).pipe(
    Effect.timeout("60 seconds"),
    Effect.catch((error) =>
      Effect.succeed({
        error: error instanceof Error ? error.message : String(error),
      }),
    ),
  );
