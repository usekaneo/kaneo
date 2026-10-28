import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { renderWorkspaceChange } from "../../admin/render-workspace-change.js";
import { resolveWorkspace } from "../../admin/resolve-workspace.js";
import { leaveOrganization } from "../../api/workspace-admin.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit, note } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

export const runWorkspaceLeave = Effect.fn("command.workspace.leave")(
  function* (options: { readonly workspace: string; readonly yes: boolean }) {
    const session = yield* Session;
    const { workspace } = yield* resolveWorkspace(
      Option.some(options.workspace),
    );

    yield* confirmDestructive({
      yes: options.yes,
      action: `Leaving ${workspace.name}`,
      question: `Leave ${workspace.name}? You lose access to its projects and tasks until someone invites you again.`,
    });

    yield* withSpinner(`Leaving ${workspace.name}`)(
      leaveOrganization(workspace.id),
    ).pipe(
      Effect.catchTag("InvalidRequest", (error) =>
        Effect.fail(
          /only owner/i.test(error.message)
            ? new InvalidArgument({
                message: `You are the only owner of ${workspace.name}, so you cannot leave it.`,
                hint: `Make another member an owner first with kaneo member role <member> owner -w ${workspace.slug}, or delete the workspace with kaneo workspace delete ${workspace.slug}.`,
              })
            : error,
        ),
      ),
    );

    yield* emit(
      {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        left: true,
      },
      (ui, value) =>
        renderWorkspaceChange(ui, { verb: "Left", workspace: value }),
    );
    if (Option.getOrUndefined(session.workspace)?.id === workspace.id) {
      yield* note((ui) => [
        `  ${ui.theme.warning(ui.glyphs.warning)} It was your current workspace. Run kaneo workspace use to choose another.`,
        "",
      ]);
    }
  },
);

export const workspaceLeave = Command.make(
  "leave",
  {
    workspace: Argument.String("workspace").pipe(
      Argument.withDescription("Workspace slug, name or id"),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Leave without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runWorkspaceLeave(options),
).pipe(
  Command.withDescription("Leave a workspace you are a member of"),
  Command.provide(ApiLayer),
);
