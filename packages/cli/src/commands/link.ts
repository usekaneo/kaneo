import { dirname } from "node:path";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { listProjects, listWorkspaces } from "../api/endpoints.js";
import type { Project, Workspace } from "../api/schemas.js";
import {
  linkFilePath,
  mergeRepoLink,
  readRepoConfigObject,
  writeRepoConfig,
} from "../config/repo-config.js";
import { InvalidArgument, ProjectNotFound } from "../errors/errors.js";
import { emit, note } from "../output/emit.js";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { pick } from "../prompts/pick.js";
import type { Ui } from "../render/ui.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { matchProject } from "../services/selection.js";
import { Session } from "../services/session.js";
import { ApiLayer } from "./api-layer.js";
import { matchWorkspace } from "./workspace/match-workspace.js";

type LinkResult = {
  readonly path: string;
  readonly workspace: { readonly id: string; readonly name: string };
  readonly project: {
    readonly id: string;
    readonly key: string;
    readonly name: string;
  };
};

export function renderLink(ui: Ui, result: LinkResult): string[] {
  const { theme, glyphs } = ui;
  return [
    `  ${theme.success(glyphs.tick)} Linked ${dirname(result.path)} to ${result.workspace.name} ${theme.muted(glyphs.separator)} ${theme.strong(result.project.key)}`,
  ];
}

const chooseWorkspace = Effect.fn("link.workspace")(function* (
  reference: Option.Option<string>,
) {
  const workspaces = yield* withSpinner("Loading workspaces")(listWorkspaces());
  if (Option.isSome(reference)) {
    const match = matchWorkspace(workspaces, reference.value);
    if (match.kind === "found") return match.workspace;
    return yield* new InvalidArgument({
      message:
        match.kind === "ambiguous"
          ? `"${reference.value}" matches ${match.candidates.length} workspaces.`
          : `No workspace matches "${reference.value}".`,
      hint: "Pass the workspace id or slug. Run kaneo workspace list to see them.",
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
  return yield* pick<Workspace>(
    "Link this repository to which workspace?",
    workspaces.map((workspace) => ({
      title: workspace.name,
      value: workspace,
      description: workspace.slug,
    })),
  );
});

const chooseProject = Effect.fn("link.project")(function* (
  workspace: Workspace,
  reference: Option.Option<string>,
) {
  const projects = (yield* withSpinner("Loading projects")(
    listProjects(workspace.id),
  )).filter((project) => project.archivedAt === null);
  if (Option.isSome(reference)) {
    const match = matchProject(projects, reference.value);
    if (match) return match;
    return yield* new ProjectNotFound({ query: reference.value, source: null });
  }
  const [only] = projects;
  if (!only) {
    return yield* new InvalidArgument({
      message: `${workspace.name} has no projects yet.`,
      hint: "Create one in the Kaneo web app, then run this again.",
    });
  }
  if (projects.length === 1) return only;
  return yield* pick<Project>(
    "Link this repository to which project?",
    projects.map((project) => ({
      title: project.name,
      value: project,
      description: project.slug.toUpperCase(),
    })),
  );
});

export const runLink = Effect.fn("command.link")(function* (options: {
  readonly project: Option.Option<string>;
}) {
  const session = yield* Session;
  const output = yield* Output;
  const environment = yield* CliEnvironment;

  const workspaceRef = Option.flatMap(session.workspace, (workspace) =>
    workspace.source === "flag" || workspace.source === "env"
      ? Option.some(workspace.id)
      : Option.none(),
  );
  if (!output.interactive && Option.isNone(workspaceRef)) {
    return yield* new InvalidArgument({
      message: "Which workspace should this repository use?",
      hint: "Pass -w with the workspace id or slug, for example kaneo link -w acme-studio -p KAN.",
    });
  }
  if (!output.interactive && Option.isNone(options.project)) {
    return yield* new InvalidArgument({
      message: "Which project should this repository use?",
      hint: "Pass -p with the project key, for example kaneo link -w acme-studio -p KAN.",
    });
  }

  const path = linkFilePath(environment.cwd);
  const existing = yield* readRepoConfigObject(path);
  const workspace = yield* chooseWorkspace(workspaceRef);
  const project = yield* chooseProject(workspace, options.project);
  const key = project.slug.toUpperCase();

  yield* writeRepoConfig(
    path,
    mergeRepoLink(existing, { workspace: workspace.id, project: key }),
  );

  yield* emit<LinkResult>(
    {
      path,
      workspace: { id: workspace.id, name: workspace.name },
      project: { id: project.id, key, name: project.name },
    },
    renderLink,
  );

  const overrides = ["KANEO_WORKSPACE", "KANEO_PROJECT"].filter((name) =>
    environment.env[name]?.trim(),
  );
  if (overrides.length > 0) {
    yield* note((ui) => [
      ...overrides.map(
        (name) =>
          `  ${ui.theme.warning(ui.glyphs.warning)} ${name} is set and overrides .kaneo.json until you unset it.`,
      ),
      "",
    ]);
  }
});

export const linkCommand = Command.make(
  "link",
  {
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
  },
  (options) => runLink(options),
).pipe(
  Command.withDescription(
    "Save the workspace (-w) and project (-p) for this repository in .kaneo.json",
  ),
  Command.provide(ApiLayer),
);
