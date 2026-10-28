import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { ACTIVITY_LIMIT_MAX, listTaskActivity } from "../../api/activity.js";
import { listMembers } from "../../api/endpoints.js";
import type { WorkspaceMember } from "../../api/schemas.js";
import {
  toActivityEntry,
  toActivityJson,
} from "../../comments/describe-activity.js";
import { renderActivity } from "../../comments/render-activity.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

export const runTaskActivity = Effect.fn("command.task.activity")(
  function* (options: { readonly task: string; readonly limit: number }) {
    if (options.limit < 1) {
      return yield* new InvalidArgument({
        message: "--limit must be at least 1.",
      });
    }
    const fetchLimit =
      options.limit < ACTIVITY_LIMIT_MAX ? options.limit + 1 : undefined;
    const { resolved, activities, members } = yield* withSpinner(
      `Loading activity on ${options.task}`,
    )(
      Effect.gen(function* () {
        const resolved = yield* resolveTask(options.task, { columns: true });
        const [activities, members] = yield* Effect.all(
          [
            listTaskActivity(resolved.task.id, fetchLimit),
            listMembers(resolved.workspaceId).pipe(
              Effect.catchTag("PermissionDenied", () =>
                Effect.succeed([] as ReadonlyArray<WorkspaceMember>),
              ),
            ),
          ],
          { concurrency: 2 },
        );
        return { resolved, activities, members };
      }),
    );

    const now = new Date();
    const lookups = {
      members: new Map(members.map((member) => [member.id, member.name])),
      statuses: new Map(
        resolved.columns.map((column) => [column.slug, column.name]),
      ),
      now,
    };
    const entries = activities
      .slice(0, options.limit)
      .reverse()
      .map((activity) => toActivityEntry(activity, lookups));

    yield* emit(entries.map(toActivityJson), (ui) =>
      renderActivity(ui, {
        label: resolved.ticketId ?? resolved.task.id.slice(0, 8),
        title: resolved.task.title,
        url: resolved.url,
        entries,
        more: activities.length > options.limit,
        now,
      }),
    );
  },
);

export const taskActivity = Command.make(
  "activity",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withAlias("L"),
      Flag.withDescription("Show only the latest events, up to this many"),
      Flag.withDefault(30),
    ),
  },
  (options) => runTaskActivity(options),
).pipe(
  Command.withDescription(
    "Show the history of a task: status changes, assignments, comments and more",
  ),
  Command.provide(ApiLayer),
);
