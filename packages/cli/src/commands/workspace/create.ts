import { Effect, Option } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";
import {
  type WorkspaceJson,
  renderWorkspaceChange,
} from "../../admin/render-workspace-change.js";
import {
  checkWorkspaceSlug,
  deriveWorkspaceSlug,
} from "../../admin/workspace-slug.js";
import {
  createOrganization,
  isWorkspaceSlugFree,
  listOrganizations,
} from "../../api/workspace-admin.js";
import { Cancelled, InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { promptTheme } from "../../prompts/prompt-theme.js";
import { ApiLayer } from "../api-layer.js";

const SLUG_ATTEMPTS = 5;

const resolveName = Effect.fnUntraced(function* (name: Option.Option<string>) {
  const output = yield* Output;
  const given = name.pipe(
    Option.map((value) => value.trim()),
    Option.filter((value) => value !== ""),
  );
  if (Option.isSome(given)) return given.value;
  if (output.interactive) {
    return yield* Prompt.run(
      Prompt.String({
        message: "Workspace name",
        validate: (value) =>
          value.trim() === ""
            ? Effect.fail("Enter a name")
            : Effect.succeed(value.trim()),
        theme: promptTheme(output.ui),
      }),
    ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
  }
  return yield* new InvalidArgument({
    message: "A workspace name is required.",
    hint: 'Pass it as the first argument, for example kaneo workspace create "Acme Studio".',
  });
});

const chooseSlug = Effect.fnUntraced(function* (
  name: string,
  requested: Option.Option<string>,
) {
  if (Option.isSome(requested)) {
    const slug = yield* Effect.fromResult(checkWorkspaceSlug(requested.value));
    const free = yield* withSpinner("Checking the slug")(
      isWorkspaceSlugFree(slug),
    );
    if (!free) {
      return yield* new InvalidArgument({
        message: `The slug ${slug} is already taken.`,
        hint: "Pass another --slug, or leave it out to get a free one.",
      });
    }
    return slug;
  }
  const taken = (yield* withSpinner("Loading workspaces")(
    listOrganizations(),
  )).map((organization) => organization.slug);
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const slug = deriveWorkspaceSlug(name, taken);
    if (yield* withSpinner("Checking the slug")(isWorkspaceSlugFree(slug))) {
      return slug;
    }
    taken.push(slug);
  }
  return yield* new InvalidArgument({
    message: "Could not find a free slug for this workspace.",
    hint: "Pass one with --slug.",
  });
});

export const runWorkspaceCreate = Effect.fn("command.workspace.create")(
  function* (options: {
    readonly name: Option.Option<string>;
    readonly slug: Option.Option<string>;
  }) {
    const name = yield* resolveName(options.name);
    const slug = yield* chooseSlug(name, options.slug);
    const created = yield* withSpinner(`Creating ${name}`)(
      createOrganization({ name, slug }),
    );
    const workspace: WorkspaceJson = {
      id: created.id,
      name: created.name,
      slug: created.slug,
      description: created.description ?? null,
    };
    yield* emit(workspace, (ui, value) =>
      renderWorkspaceChange(ui, {
        verb: "Created",
        workspace: value,
        next: `Run kaneo workspace use ${value.slug} to make it your default.`,
      }),
    );
  },
);

export const workspaceCreate = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(
      Argument.withDescription(
        "Workspace name; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    slug: Flag.String("slug").pipe(
      Flag.withDescription(
        "URL slug such as acme-studio (default: derived from the name)",
      ),
      Flag.optional,
    ),
  },
  (options) => runWorkspaceCreate(options),
).pipe(
  Command.withDescription("Create a workspace and become its owner"),
  Command.provide(ApiLayer),
);
