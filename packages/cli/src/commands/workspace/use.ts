import { Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";
import { listWorkspaces } from "../../api/endpoints.js";
import type { Workspace } from "../../api/schemas.js";
import { ConfigStore } from "../../config/config-store.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit, note } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { pick } from "../../prompts/pick.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";
import { matchWorkspace } from "./match-workspace.js";
import { overrideNotice } from "./override-notice.js";
import { rememberWorkspace } from "./remember-workspace.js";
import { renderWorkspaceUsed } from "./render-workspace-used.js";

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const chooseWorkspace = Effect.fn("workspace.use.choose")(function* (
  workspaces: ReadonlyArray<Workspace>,
  reference: Option.Option<string>,
) {
  const session = yield* Session;
  const output = yield* Output;
  if (Option.isSome(reference)) {
    const match = matchWorkspace(workspaces, reference.value);
    if (match.kind === "found") return match.workspace;
    if (match.kind === "ambiguous") {
      return yield* new InvalidArgument({
        message: `"${reference.value}" matches ${match.candidates.length} workspaces.`,
        hint: `Use a slug instead: ${match.candidates.map((workspace) => workspace.slug).join(", ")}.`,
      });
    }
    return yield* new InvalidArgument({
      message: `No workspace matches "${reference.value}".`,
      hint: "Run kaneo workspace list to see your workspaces.",
    });
  }
  const [only] = workspaces;
  if (!only) {
    return yield* new InvalidArgument({
      message: "You are not a member of any workspace yet.",
      hint: "Create one in the Kaneo web app, then run this again.",
    });
  }
  if (workspaces.length === 1) return only;
  const currentId = Option.getOrUndefined(session.workspace)?.id;
  const { separator } = output.ui.glyphs;
  return yield* pick(
    "Choose your default workspace",
    workspaces.map((workspace) => ({
      title: workspace.name,
      value: workspace,
      description:
        workspace.id === currentId
          ? `${workspace.slug} ${separator} current`
          : workspace.slug,
    })),
  );
});

export const runWorkspaceUse = Effect.fn("command.workspace.use")(
  function* (options: { readonly workspace: Option.Option<string> }) {
    const session = yield* Session;
    const output = yield* Output;
    const store = yield* ConfigStore;

    if (Option.isSome(session.configProblem)) {
      return yield* Effect.fail(session.configProblem.value);
    }
    if (Option.isNone(options.workspace) && !output.interactive) {
      return yield* new InvalidArgument({
        message: "Which workspace should be the default?",
        hint: "Pass its slug, name or id, for example kaneo workspace use acme-studio. Run kaneo workspace list to see them.",
      });
    }

    const workspaces =
      yield* withSpinner("Loading workspaces")(listWorkspaces());
    const workspace = yield* chooseWorkspace(workspaces, options.workspace);

    const remembered = rememberWorkspace(
      yield* store.load,
      session.profileName,
      session.apiUrl,
      workspace.id,
    );
    if (remembered.kind === "other-server") {
      return yield* new InvalidArgument({
        message: `The profile "${session.profileName}" belongs to ${host(remembered.profileApiUrl)}, not ${host(session.apiUrl)}.`,
        hint: "Pass --profile with another name to keep a default for this server.",
      });
    }
    yield* store.save(remembered.config);

    yield* emit(
      {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          role: workspace.role,
          description: workspace.description,
        },
      },
      renderWorkspaceUsed,
    );

    const notice = overrideNotice(
      session.workspace,
      session.repo?.path,
      workspace.id,
    );
    if (notice) {
      yield* note((ui) => [
        `  ${ui.theme.warning(ui.glyphs.warning)} ${notice}`,
        "",
      ]);
    }
  },
);

export const workspaceUse = Command.make(
  "use",
  {
    workspace: Argument.String("workspace").pipe(
      Argument.withDescription("Workspace slug, name or id"),
      Argument.optional,
    ),
  },
  (options) => runWorkspaceUse(options),
).pipe(
  Command.withDescription("Choose the default workspace for your commands"),
  Command.provide(ApiLayer),
);
