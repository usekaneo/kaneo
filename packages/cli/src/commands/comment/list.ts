import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listComments } from "../../api/comments.js";
import { latest, toCommentJson } from "../../comments/comment-json.js";
import { renderCommentList } from "../../comments/render-comment-list.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

export const runCommentList = Effect.fn("command.comment.list")(
  function* (options: { readonly task: string; readonly limit: number }) {
    if (options.limit < 1) {
      return yield* new InvalidArgument({
        message: "--limit must be at least 1.",
      });
    }
    const { resolved, comments } = yield* withSpinner(
      `Loading comments on ${options.task}`,
    )(
      Effect.gen(function* () {
        const resolved = yield* resolveTask(options.task);
        const comments = yield* listComments(resolved.task.id);
        return { resolved, comments };
      }),
    );
    const shown = latest(comments, options.limit).map(toCommentJson);

    yield* emit(shown, (ui, value) =>
      renderCommentList(ui, {
        label: resolved.ticketId ?? resolved.task.id.slice(0, 8),
        title: resolved.task.title,
        url: resolved.url,
        comments: value,
        total: comments.length,
        now: new Date(),
      }),
    );
  },
);

export const commentList = Command.make(
  "list",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withAlias("L"),
      Flag.withDescription("Show only the latest comments, up to this many"),
      Flag.withDefault(50),
    ),
  },
  (options) => runCommentList(options),
).pipe(
  Command.withDescription("Show the comments on a task, oldest first"),
  Command.provide(ApiLayer),
);
