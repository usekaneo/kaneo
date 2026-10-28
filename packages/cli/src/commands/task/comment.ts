import { Effect } from "effect";
import { Argument, Command, Prompt } from "effect/cli";
import { COMMENT_MAX_LENGTH, createComment } from "../../api/task-actions.js";
import { Cancelled, InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { promptTheme } from "../../prompts/prompt-theme.js";
import { CliEnvironment } from "../../services/cli-environment.js";
import { normalizeComment } from "../../tasks/comment-text.js";
import { readStream } from "../../tasks/read-stdin.js";
import { renderCommentAdded } from "../../tasks/render-comment-added.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

const TEXT_HINT = "Pass the text after the task, or pipe it on stdin.";

const askForComment = Effect.fnUntraced(function* (message: string) {
  const output = yield* Output;
  return yield* Prompt.run(
    Prompt.String({
      message,
      validate: (value) =>
        value.trim() === ""
          ? Effect.fail("Write a comment, or press Ctrl+C to cancel")
          : Effect.succeed(value),
      theme: promptTheme(output.ui),
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});

const readComment = Effect.fnUntraced(function* (
  words: ReadonlyArray<string>,
  label: string,
) {
  const output = yield* Output;
  const environment = yield* CliEnvironment;
  if (words.length > 0) return words.join(" ");
  if (!environment.stdin.isTTY) {
    return yield* Effect.tryPromise({
      try: () => readStream(process.stdin),
      catch: () =>
        new InvalidArgument({
          message: "Could not read the comment from stdin.",
          hint: TEXT_HINT,
        }),
    });
  }
  if (output.interactive) return yield* askForComment(`Comment on ${label}`);
  return yield* new InvalidArgument({
    message: `Pass the comment for ${label}.`,
    hint: TEXT_HINT,
  });
});

export const runTaskComment = Effect.fn("command.task.comment")(
  function* (options: {
    readonly task: string;
    readonly text: ReadonlyArray<string>;
  }) {
    const resolved = yield* withSpinner(`Loading ${options.task}`)(
      resolveTask(options.task),
    );
    const label = resolved.ticketId ?? resolved.task.id.slice(0, 8);
    const content = normalizeComment(yield* readComment(options.text, label));
    if (content === "") {
      return yield* new InvalidArgument({
        message: "The comment is empty.",
        hint: TEXT_HINT,
      });
    }
    if (content.length > COMMENT_MAX_LENGTH) {
      return yield* new InvalidArgument({
        message: `The comment is ${content.length} characters long, and the limit is ${COMMENT_MAX_LENGTH}.`,
      });
    }

    const comment = yield* withSpinner(`Commenting on ${label}`)(
      createComment(resolved.task.id, content),
    );

    yield* emit(
      {
        id: comment.id,
        taskId: comment.taskId,
        content: comment.content ?? content,
        createdAt: comment.createdAt,
        url: resolved.url,
      },
      (ui) =>
        renderCommentAdded(ui, {
          label,
          url: resolved.url,
          content: comment.content ?? content,
        }),
    );
  },
);

export const taskComment = Command.make(
  "comment",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    text: Argument.String("text").pipe(
      Argument.withDescription("The comment; read from stdin when left out"),
      Argument.variadic(),
    ),
  },
  (options) => runTaskComment(options),
).pipe(
  Command.withDescription("Add a comment to a task"),
  Command.provide(ApiLayer),
);
