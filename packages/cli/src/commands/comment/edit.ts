import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { updateComment } from "../../api/comments.js";
import { COMMENT_MAX_LENGTH } from "../../api/task-actions.js";
import { asOwnComment } from "../../comments/own-comment.js";
import { readCommentText } from "../../comments/read-comment-input.js";
import { renderCommentChange } from "../../comments/render-comment-change.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { normalizeComment } from "../../tasks/comment-text.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

export const runCommentEdit = Effect.fn("command.comment.edit")(
  function* (options: {
    readonly comment: string;
    readonly text: ReadonlyArray<string>;
    readonly file: Option.Option<string>;
  }) {
    const id = options.comment.trim();
    const command = `kaneo comment edit ${id}`;
    const content = normalizeComment(
      yield* readCommentText({
        words: options.text,
        file: options.file,
        command,
        prompt: "New text for the comment",
      }),
    );
    if (content === "") {
      return yield* new InvalidArgument({
        message: "The comment is empty.",
        hint: `To remove it, run kaneo comment delete ${id}.`,
      });
    }
    if (content.length > COMMENT_MAX_LENGTH) {
      return yield* new InvalidArgument({
        message: `The comment is ${content.length} characters long, and the limit is ${COMMENT_MAX_LENGTH}.`,
      });
    }

    const updated = yield* withSpinner("Saving the comment")(
      updateComment(id, content).pipe(asOwnComment(id)),
    );
    const task = yield* resolveTask(updated.taskId).pipe(Effect.option);
    const label = Option.match(task, {
      onNone: () => updated.taskId.slice(0, 8),
      onSome: (resolved) => resolved.ticketId ?? resolved.task.id.slice(0, 8),
    });
    const url = Option.getOrUndefined(task)?.url ?? null;

    yield* emit(
      {
        id: updated.id,
        taskId: updated.taskId,
        ticketId: Option.getOrUndefined(task)?.ticketId ?? null,
        content: updated.content ?? content,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        edited: true,
        url,
      },
      (ui, value) =>
        renderCommentChange(ui, {
          verb: "Edited",
          label,
          url: value.url ?? "",
          content: value.content,
        }),
    );
  },
);

export const commentEdit = Command.make(
  "edit",
  {
    comment: Argument.String("comment-id").pipe(
      Argument.withDescription("The comment id, from kaneo comment list"),
    ),
    text: Argument.String("text").pipe(
      Argument.withDescription(
        "The new text in Markdown, or - for stdin; asked for when left out",
      ),
      Argument.variadic(),
    ),
    file: Flag.String("file").pipe(
      Flag.withAlias("F"),
      Flag.withDescription("Read the new text from a file, or - for stdin"),
      Flag.optional,
    ),
  },
  (options) => runCommentEdit(options),
).pipe(
  Command.withDescription("Change the text of one of your comments"),
  Command.provide(ApiLayer),
);
