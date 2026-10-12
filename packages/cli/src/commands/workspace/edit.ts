import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { metadataWithDescription } from "../../admin/description-metadata.js";
import {
  type WorkspaceJson,
  renderWorkspaceChange,
} from "../../admin/render-workspace-change.js";
import { resolveWorkspace } from "../../admin/resolve-workspace.js";
import { checkWorkspaceSlug } from "../../admin/workspace-slug.js";
import {
  isWorkspaceSlugFree,
  updateOrganization,
  type WorkspaceChanges,
} from "../../api/workspace-admin.js";
import { InvalidArgument } from "../../errors/errors.js";
import { readTextInput } from "../../input/read-text-input.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { ApiLayer } from "../api-layer.js";

export const runWorkspaceEdit = Effect.fn("command.workspace.edit")(
  function* (options: {
    readonly workspace: Option.Option<string>;
    readonly name: Option.Option<string>;
    readonly slug: Option.Option<string>;
    readonly description: Option.Option<string>;
    readonly descriptionFile: Option.Option<string>;
  }) {
    const description = yield* readTextInput({
      value: options.description,
      file: options.descriptionFile,
      flag: "--description",
    });
    if (
      Option.isNone(options.name) &&
      Option.isNone(options.slug) &&
      Option.isNone(description)
    ) {
      return yield* new InvalidArgument({
        message: "Nothing to change.",
        hint: "Pass --name, --slug, or --description (-d) with the new value.",
      });
    }
    const name = Option.map(options.name, (value) => value.trim());
    if (Option.isSome(name) && name.value === "") {
      return yield* new InvalidArgument({
        message: "--name cannot be empty.",
      });
    }
    const slug = Option.isSome(options.slug)
      ? Option.some(
          yield* Effect.fromResult(checkWorkspaceSlug(options.slug.value)),
        )
      : Option.none<string>();

    const { workspace, organization } = yield* resolveWorkspace(
      options.workspace,
    );
    const data: {
      -readonly [Key in keyof WorkspaceChanges]: WorkspaceChanges[Key];
    } = {};
    const changed: string[] = [];
    if (Option.isSome(name) && name.value !== workspace.name) {
      data.name = name.value;
      changed.push("name");
    }
    if (Option.isSome(slug) && slug.value !== workspace.slug) {
      const free = yield* withSpinner("Checking the slug")(
        isWorkspaceSlugFree(slug.value),
      );
      if (!free) {
        return yield* new InvalidArgument({
          message: `The slug ${slug.value} is already taken.`,
          hint: "Choose another slug.",
        });
      }
      data.slug = slug.value;
      changed.push("slug");
    }
    const text = Option.map(description, (value) => value.trim());
    if (Option.isSome(text) && text.value !== (workspace.description ?? "")) {
      data.description = text.value;
      const metadata = metadataWithDescription(
        organization.metadata,
        text.value,
      );
      if (metadata) data.metadata = metadata;
      changed.push("description");
    }

    const result: WorkspaceJson =
      changed.length === 0
        ? {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            description: workspace.description,
          }
        : yield* withSpinner(`Updating ${workspace.name}`)(
            updateOrganization(workspace.id, data),
          ).pipe(
            Effect.map((updated) => ({
              id: updated.id,
              name: updated.name,
              slug: updated.slug,
              description:
                data.description !== undefined
                  ? data.description || null
                  : workspace.description,
            })),
          );
    yield* emit({ ...result, changed }, (ui, value) =>
      renderWorkspaceChange(ui, {
        verb: "Updated",
        workspace: value,
        changed: value.changed,
      }),
    );
  },
);

export const workspaceEdit = Command.make(
  "edit",
  {
    workspace: Argument.String("workspace").pipe(
      Argument.withDescription(
        "Workspace slug, name or id (default: the current workspace)",
      ),
      Argument.optional,
    ),
    name: Flag.String("name").pipe(
      Flag.withDescription("New workspace name"),
      Flag.optional,
    ),
    slug: Flag.String("slug").pipe(
      Flag.withDescription("New URL slug, such as acme-studio"),
      Flag.optional,
    ),
    description: Flag.String("description").pipe(
      Flag.withAlias("d"),
      Flag.withDescription(
        'New description, or - to read stdin; pass "" to clear it',
      ),
      Flag.optional,
    ),
    descriptionFile: Flag.String("description-file").pipe(
      Flag.withAlias("F"),
      Flag.withDescription("Read the description from a file, or - for stdin"),
      Flag.optional,
    ),
  },
  (options) => runWorkspaceEdit(options),
).pipe(
  Command.withDescription(
    "Rename a workspace or change its slug or description",
  ),
  Command.provide(ApiLayer),
);
