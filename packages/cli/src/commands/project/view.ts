import { Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";
import { listColumns } from "../../api/endpoints.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { toProjectView } from "../../projects/project-view.js";
import { renderProjectView } from "../../projects/render-project-view.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { loadBoard } from "../../tasks/load-board.js";
import { ApiLayer } from "../api-layer.js";

const TASK_LIMIT = 1000;

export const runProjectView = Effect.fn("command.project.view")(
  function* (options: { readonly project: Option.Option<string> }) {
    const session = yield* Session;
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project).pipe(
      Effect.catchTag("ProjectRequired", () =>
        Effect.fail(
          new InvalidArgument({
            message: "Which project should be shown?",
            hint: "Pass its key or id, for example kaneo project view KAN.",
          }),
        ),
      ),
    );
    const [columns, board] = yield* withSpinner(`Loading ${project.name}`)(
      Effect.all(
        [listColumns(project.id), loadBoard(project.id, {}, TASK_LIMIT)],
        {
          concurrency: 2,
        },
      ),
    );
    const view = toProjectView(project, columns, board, session.webUrl);
    yield* emit(view, (ui) =>
      renderProjectView(ui, { ...view, taskLimit: TASK_LIMIT }),
    );
  },
);

export const projectView = Command.make(
  "view",
  {
    project: Argument.String("project").pipe(
      Argument.withDescription("Project key or id, for example KAN"),
      Argument.optional,
    ),
  },
  (options) => runProjectView(options),
).pipe(
  Command.withDescription("Show a project with its columns and task counts"),
  Command.provide(ApiLayer),
);
