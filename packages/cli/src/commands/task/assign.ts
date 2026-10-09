import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listMembers } from "../../api/endpoints.js";
import { updateTaskAssignee } from "../../api/task-actions.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { pick } from "../../prompts/pick.js";
import { renderAssignment } from "../../tasks/render-assignment.js";
import {
  type Assignee,
  resolveAssignee,
} from "../../tasks/resolve-assignee.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

const USER_HINT =
  'Use "me", an email address, a name, or a user id, or pass --unassign.';

export const runTaskAssign = Effect.fn("command.task.assign")(
  function* (options: {
    readonly task: string;
    readonly user: Option.Option<string>;
    readonly unassign: boolean;
  }) {
    const output = yield* Output;
    if (options.unassign && Option.isSome(options.user)) {
      return yield* new InvalidArgument({
        message: "Pass a user or --unassign, not both.",
        hint: USER_HINT,
      });
    }
    const resolved = yield* withSpinner(`Loading ${options.task}`)(
      resolveTask(options.task),
    );
    const label = resolved.ticketId ?? resolved.task.id.slice(0, 8);

    const assignee: Assignee | null = options.unassign
      ? null
      : yield* Option.match(options.user, {
          onSome: (reference) =>
            withSpinner("Finding the user")(
              resolveAssignee(resolved.workspaceId, reference),
            ),
          onNone: () =>
            output.interactive
              ? withSpinner("Loading members")(
                  listMembers(resolved.workspaceId),
                ).pipe(
                  Effect.flatMap((members) =>
                    pick<Assignee | null>(`Assign ${label} to`, [
                      {
                        title: "Unassigned",
                        value: null,
                        description:
                          resolved.task.assigneeId === null
                            ? "current"
                            : undefined,
                      },
                      ...members.map((member) => ({
                        title: member.name,
                        value: { id: member.id, name: member.name },
                        description:
                          member.id === resolved.task.assigneeId
                            ? `${member.email}, current`
                            : member.email,
                      })),
                    ]),
                  ),
                )
              : Effect.fail(
                  new InvalidArgument({
                    message: `Pass the user to assign ${label} to.`,
                    hint: USER_HINT,
                  }),
                ),
        });

    yield* withSpinner(
      assignee ? `Assigning ${label}` : `Unassigning ${label}`,
    )(updateTaskAssignee(resolved.task.id, assignee?.id ?? null));

    yield* emit(
      {
        id: resolved.task.id,
        ticketId: resolved.ticketId,
        assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
        url: resolved.url,
      },
      (ui) => renderAssignment(ui, { label, url: resolved.url, assignee }),
    );
  },
);

export const taskAssign = Command.make(
  "assign",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    user: Argument.String("user").pipe(
      Argument.withDescription('"me", an email address, a name, or a user id'),
      Argument.optional,
    ),
    unassign: Flag.Boolean("unassign").pipe(
      Flag.withDescription("Remove the assignee"),
      Flag.withDefault(false),
    ),
  },
  (options) => runTaskAssign(options),
).pipe(
  Command.withDescription(
    "Assign a task to a workspace member, or unassign it",
  ),
  Command.provide(ApiLayer),
);
