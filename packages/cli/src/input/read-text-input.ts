import { readFile } from "node:fs/promises";
import { Effect, Option } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { readStream } from "../tasks/read-stdin.js";

export type TextInput = {
  readonly value: Option.Option<string>;
  readonly file: Option.Option<string>;
  readonly flag: string;
};

export function stripByteOrderMark(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

const readStdin = Effect.fnUntraced(function* (flag: string) {
  const environment = yield* CliEnvironment;
  if (environment.stdin.isTTY) {
    return yield* new InvalidArgument({
      message: `${flag} - reads from stdin, but nothing is piped in.`,
      hint: `Pipe the text in, for example: cat notes.md | kaneo ... ${flag} -`,
    });
  }
  return yield* Effect.tryPromise({
    try: () => readStream(process.stdin),
    catch: () => new InvalidArgument({ message: "Could not read from stdin." }),
  });
});

export const readTextInput = Effect.fnUntraced(function* (input: TextInput) {
  if (Option.isSome(input.value) && Option.isSome(input.file)) {
    return yield* new InvalidArgument({
      message: `Pass either ${input.flag} or a file, not both.`,
    });
  }
  if (Option.isSome(input.file)) {
    const path = input.file.value;
    const text =
      path === "-"
        ? yield* readStdin(`${input.flag}-file`)
        : yield* Effect.tryPromise({
            try: () => readFile(path, "utf8"),
            catch: () =>
              new InvalidArgument({
                message: `Could not read ${path}.`,
                hint: "Check the path and that the file is readable.",
              }),
          });
    return Option.some(stripByteOrderMark(text));
  }
  if (Option.isSome(input.value)) {
    return Option.some(
      input.value.value === "-"
        ? stripByteOrderMark(yield* readStdin(input.flag))
        : input.value.value,
    );
  }
  return Option.none<string>();
});
