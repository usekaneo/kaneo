import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { stripByteOrderMark } from "../input/read-text-input.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { readStream } from "../tasks/read-stdin.js";

export const readImportSource = Effect.fnUntraced(function* (path: string) {
  if (path !== "-") {
    const content = yield* Effect.tryPromise({
      try: () => readFile(path, "utf8"),
      catch: () =>
        new InvalidArgument({
          message: `Could not read ${path}.`,
          hint: "Check the path and that the file is readable.",
        }),
    });
    return stripByteOrderMark(content);
  }
  const environment = yield* CliEnvironment;
  if (environment.stdin.isTTY) {
    return yield* new InvalidArgument({
      message: "- reads the tasks from stdin, but nothing is piped in.",
      hint: "Pipe the file in, for example: kaneo task export -p KAN | kaneo task import - -p MOB --yes",
    });
  }
  const content = yield* Effect.tryPromise({
    try: () => readStream(process.stdin),
    catch: () => new InvalidArgument({ message: "Could not read from stdin." }),
  });
  return stripByteOrderMark(content);
});
