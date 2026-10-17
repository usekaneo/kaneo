import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { readCommentInput } from "../../comments/read-comment-input.js";
import { ApiLayer } from "../api-layer.js";
import { runTaskComment } from "../task/comment.js";

export const runCommentAdd = Effect.fn("command.comment.add")(
  function* (options: {
    readonly task: string;
    readonly text: ReadonlyArray<string>;
    readonly file: Option.Option<string>;
  }) {
    const content = yield* readCommentInput({
      words: options.text,
      file: options.file,
      command: `kaneo comment add ${options.task}`,
    });
    yield* runTaskComment({
      task: options.task,
      text: Option.match(content, {
        onNone: () => [],
        onSome: (value) => [value],
      }),
    });
  },
);

export const commentAdd = Command.make(
  "add",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    text: Argument.String("text").pipe(
      Argument.withDescription(
        "The comment in Markdown, or - for stdin; read from stdin when left out",
      ),
      Argument.variadic(),
    ),
    file: Flag.String("file").pipe(
      Flag.withAlias("F"),
      Flag.withDescription("Read the comment from a file, or - for stdin"),
      Flag.optional,
    ),
  },
  (options) => runCommentAdd(options),
).pipe(
  Command.withDescription("Add a comment to a task"),
  Command.provide(ApiLayer),
);
