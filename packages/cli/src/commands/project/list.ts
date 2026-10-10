import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { listProjectSummaries } from "../../api/project-summaries.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { toProjectJson } from "../../projects/project-json.js";
import { renderProjectList } from "../../projects/render-project-list.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

export const runProjectList = Effect.fn("command.project.list")(
  function* (options: { readonly archived: boolean }) {
    const session = yield* Session;
    const workspaceId = yield* resolveWorkspaceId();
    const projects = yield* withSpinner("Loading projects")(
      listProjectSummaries(workspaceId, { includeArchived: options.archived }),
    );
    const json = projects.map((project) =>
      toProjectJson(project, session.webUrl),
    );
    yield* emit(json, (ui) =>
      renderProjectList(ui, {
        projects: json,
        includeArchived: options.archived,
        now: new Date(),
      }),
    );
  },
);

export const projectList = Command.make(
  "list",
  {
    archived: Flag.Boolean("archived").pipe(
      Flag.withDescription("Include archived projects"),
      Flag.withDefault(false),
    ),
  },
  (options) => runProjectList(options),
).pipe(
  Command.withDescription("List the projects in your workspace"),
  Command.provide(ApiLayer),
);
