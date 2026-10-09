import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { confirmBySlug } from "../../admin/confirm-slug.js";
import { renderWorkspaceChange } from "../../admin/render-workspace-change.js";
import { resolveWorkspace } from "../../admin/resolve-workspace.js";
import { deleteOrganization } from "../../api/workspace-admin.js";
import { InvalidArgument, PermissionDenied } from "../../errors/errors.js";
import { emit, note } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

export const runWorkspaceDelete = Effect.fn("command.workspace.delete")(
  function* (options: { readonly workspace: string; readonly yes: boolean }) {
    const session = yield* Session;
    const { workspace } = yield* resolveWorkspace(
      Option.some(options.workspace),
    );

    yield* confirmBySlug({
      yes: options.yes,
      action: `Deleting ${workspace.name}`,
      warning: `This permanently deletes ${workspace.name} with every project, task and comment in it, and removes all its members. It cannot be undone.`,
      slug: workspace.slug,
    });

    yield* withSpinner(`Deleting ${workspace.name}`)(
      deleteOrganization(workspace.id),
    ).pipe(
      Effect.catchTags({
        Conflict: (error) =>
          Effect.fail(
            new InvalidArgument({
              message: error.message,
              hint: "Cancel the subscription in the web app under Settings, then Billing, and run this again.",
            }),
          ),
        PermissionDenied: (error) =>
          Effect.fail(
            /not allowed to delete/i.test(error.message)
              ? new PermissionDenied({
                  message: `Only an owner can delete ${workspace.name}.`,
                  missingPermissions: ["organization:delete"],
                })
              : error,
          ),
        NotFound: (error) =>
          Effect.fail(
            /deletion is disabled/i.test(error.message)
              ? new InvalidArgument({
                  message: "This server does not allow deleting workspaces.",
                })
              : error,
          ),
      }),
    );

    yield* emit(
      {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        deleted: true,
      },
      (ui, value) =>
        renderWorkspaceChange(ui, { verb: "Deleted", workspace: value }),
    );
    if (Option.getOrUndefined(session.workspace)?.id === workspace.id) {
      yield* note((ui) => [
        `  ${ui.theme.warning(ui.glyphs.warning)} It was your current workspace. Run kaneo workspace use to choose another.`,
        "",
      ]);
    }
  },
);

export const workspaceDelete = Command.make(
  "delete",
  {
    workspace: Argument.String("workspace").pipe(
      Argument.withDescription("Workspace slug, name or id"),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without typing the slug to confirm"),
      Flag.withDefault(false),
    ),
  },
  (options) => runWorkspaceDelete(options),
).pipe(
  Command.withDescription(
    "Permanently delete a workspace with all its projects and tasks",
  ),
  Command.provide(ApiLayer),
);
