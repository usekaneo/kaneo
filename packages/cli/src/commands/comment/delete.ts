import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { deleteComment } from "../../api/comments.js";
import { asOwnComment } from "../../comments/own-comment.js";
import { renderCommentChange } from "../../comments/render-comment-change.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

export const runCommentDelete = Effect.fn("command.comment.delete")(
  function* (options: { readonly comment: string; readonly yes: boolean }) {
    const id = options.comment.trim();
    yield* confirmDestructive({
      yes: options.yes,
      action: "Deleting a comment",
      question: `Delete comment ${id}? This cannot be undone.`,
    });

    const deleted = yield* withSpinner("Deleting the comment")(
      deleteComment(id).pipe(asOwnComment(id)),
    );
    const task = yield* resolveTask(deleted.taskId).pipe(Effect.option);
    const resolved = Option.getOrUndefined(task);
    const label = resolved
      ? (resolved.ticketId ?? resolved.task.id.slice(0, 8))
      : deleted.taskId.slice(0, 8);

    yield* emit(
      {
        id: deleted.id,
        taskId: deleted.taskId,
        ticketId: resolved?.ticketId ?? null,
        deleted: true,
      },
      (ui) =>
        renderCommentChange(ui, {
          verb: "Deleted",
          label,
          url: resolved?.url ?? "",
          content: deleted.content ?? "",
        }),
    );
  },
);

export const commentDelete = Command.make(
  "delete",
  {
    comment: Argument.String("comment-id").pipe(
      Argument.withDescription("The comment id, from kaneo comment list"),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runCommentDelete(options),
).pipe(
  Command.withDescription("Delete one of your comments"),
  Command.provide(ApiLayer),
);
