import { Effect, Option } from "effect";
import { Prompt } from "effect/cli";
import { Cancelled, InvalidArgument } from "../errors/errors.js";
import { readTextInput, stripByteOrderMark } from "../input/read-text-input.js";
import { Output } from "../output/output.js";
import { promptTheme } from "../prompts/prompt-theme.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { readStream } from "../tasks/read-stdin.js";

export type CommentInput = {
  readonly words: ReadonlyArray<string>;
  readonly file: Option.Option<string>;
  readonly command: string;
};

const readPiped = Effect.fnUntraced(function* (command: string) {
  const environment = yield* CliEnvironment;
  if (environment.stdin.isTTY) {
    return yield* new InvalidArgument({
      message: "- reads the comment from stdin, but nothing is piped in.",
      hint: `Pipe the text in, for example: cat notes.md | ${command} -F -`,
    });
  }
  const text = yield* Effect.tryPromise({
    try: () => readStream(process.stdin),
    catch: () =>
      new InvalidArgument({
        message: "Could not read the comment from stdin.",
      }),
  });
  return stripByteOrderMark(text);
});

export const readCommentInput = Effect.fnUntraced(function* (
  input: CommentInput,
) {
  if (input.words.length > 0 && Option.isSome(input.file)) {
    return yield* new InvalidArgument({
      message: "Pass the comment as text or with --file, not both.",
    });
  }
  const dash =
    (input.words.length === 1 && input.words[0] === "-") ||
    Option.getOrUndefined(input.file) === "-";
  if (dash) return Option.some(yield* readPiped(input.command));
  if (Option.isSome(input.file)) {
    return yield* readTextInput({
      value: Option.none(),
      file: input.file,
      flag: "--file",
    });
  }
  return input.words.length > 0
    ? Option.some(input.words.join(" "))
    : Option.none<string>();
});

export const readCommentText = Effect.fnUntraced(function* (
  input: CommentInput & { readonly prompt: string },
) {
  const given = yield* readCommentInput(input);
  if (Option.isSome(given)) return given.value;
  const environment = yield* CliEnvironment;
  const output = yield* Output;
  if (!environment.stdin.isTTY) return yield* readPiped(input.command);
  if (!output.interactive) {
    return yield* new InvalidArgument({
      message: "Pass the new text for the comment.",
      hint: `Pass it after the id, with -F <file>, or on stdin, for example: ${input.command} "New text".`,
    });
  }
  return yield* Prompt.run(
    Prompt.String({
      message: input.prompt,
      validate: (value) =>
        value.trim() === ""
          ? Effect.fail("Write the comment, or press Ctrl+C to cancel")
          : Effect.succeed(value),
      theme: promptTheme(output.ui),
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});
