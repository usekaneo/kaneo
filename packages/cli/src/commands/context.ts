import { existsSync } from "node:fs";
import { Effect, Option, Result } from "effect";
import { Command } from "effect/cli";
import {
  getCurrentUser,
  getWorkspace,
  listProjects,
} from "../api/endpoints.js";
import {
  ApiUrlFlag,
  HumanFlag,
  JqFlag,
  JsonFlag,
  ProfileFlag,
  TokenFlag,
  WorkspaceFlag,
} from "../cli/global-flags.js";
import { ConfigStore } from "../config/config-store.js";
import type { ConfigStatus, ContextReport } from "../context/context-report.js";
import { outputProvenance } from "../context/output-provenance.js";
import { buildProvenance } from "../context/provenance.js";
import { renderContext } from "../context/render-context.js";
import { describeError } from "../errors/describe.js";
import { emit } from "../output/emit.js";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { matchProject } from "../services/selection.js";
import { Session } from "../services/session.js";
import { ApiLayer } from "./api-layer.js";

const loadDetails = Effect.fn("context.details")(function* (
  workspaceId: string | null,
  projectRef: string | null,
) {
  const [user, workspace, projects] = yield* Effect.all(
    [
      Effect.result(getCurrentUser()),
      workspaceId
        ? Effect.option(getWorkspace(workspaceId))
        : Effect.succeedNone,
      workspaceId && projectRef
        ? Effect.option(listProjects(workspaceId))
        : Effect.succeedNone,
    ],
    { concurrency: 3 },
  );
  const project = Option.flatMap(projects, (list) =>
    Option.fromUndefinedOr(
      projectRef ? matchProject(list, projectRef) : undefined,
    ),
  );
  return {
    user: Result.isSuccess(user)
      ? {
          id: user.success.id,
          name: user.success.name,
          email: user.success.email,
        }
      : null,
    error: Result.isFailure(user) ? describeError(user.failure).message : null,
    workspaceName: Option.getOrNull(
      Option.map(workspace, (value) => value.name),
    ),
    project: Option.getOrNull(project),
  };
});

export const runContext = Effect.fn("command.context")(function* () {
  const session = yield* Session;
  const output = yield* Output;
  const environment = yield* CliEnvironment;
  const store = yield* ConfigStore;

  const provenance = buildProvenance({
    flags: {
      token: yield* TokenFlag,
      apiUrl: yield* ApiUrlFlag,
      workspace: yield* WorkspaceFlag,
      profile: yield* ProfileFlag,
    },
    env: environment.env,
    config: session.config,
    configProblem: session.configProblem,
    repo: session.repo,
  });
  const configStatus: ConfigStatus = Option.isSome(session.configProblem)
    ? session.configProblem.value.reason
    : existsSync(store.path)
      ? "ok"
      : "missing";
  const mode = outputProvenance({
    json: yield* JsonFlag,
    human: yield* HumanFlag,
    env: environment.env,
    stdoutIsTTY: environment.stdout.isTTY,
  });
  const jq = Option.flatten(yield* Effect.serviceOption(JqFlag));

  const details = Option.isSome(session.credentials)
    ? yield* withSpinner("Checking your account")(
        loadDetails(provenance.workspace.id, provenance.project.ref),
      )
    : { user: null, error: null, workspaceName: null, project: null };

  yield* emit<ContextReport>(
    {
      server: provenance.server,
      web: provenance.web,
      profile: provenance.profile,
      auth: { ...provenance.auth, error: details.error },
      user: details.user,
      workspace: { ...provenance.workspace, name: details.workspaceName },
      project: {
        ...provenance.project,
        id: details.project?.id ?? null,
        key: details.project ? details.project.slug.toUpperCase() : null,
        name: details.project?.name ?? null,
      },
      config: { path: store.path, status: configStatus },
      output: {
        mode: output.mode,
        source: mode.source,
        jq: Option.getOrNull(Option.map(jq, (filter) => filter.expression)),
        interactive: output.interactive,
        stdinIsTTY: environment.stdin.isTTY,
        stdoutIsTTY: environment.stdout.isTTY,
        stderrIsTTY: environment.stderr.isTTY,
        terminal: output.ui.caps,
      },
    },
    renderContext,
  );
});

export const contextCommand = Command.make("context", {}, () =>
  runContext(),
).pipe(
  Command.withDescription(
    "Show the server, account, workspace and project in use, and where each came from",
  ),
  Command.provide(ApiLayer),
);
