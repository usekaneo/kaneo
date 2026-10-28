import { Effect } from "effect";
import { Command } from "effect/cli";
import type { Option } from "effect";
import { countColumnTasks } from "../../api/columns.js";
import { toColumnJson } from "../../columns/column-json.js";
import { renderColumnList } from "../../columns/render-column-list.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { projectUrl } from "../../render/links.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";
import { loadProjectColumns } from "./load-columns.js";
import { projectFlag } from "./project-flag.js";

export const runColumnList = Effect.fn("command.column.list")(
  function* (options: { readonly project: Option.Option<string> }) {
    const session = yield* Session;
    const { project, columns } = yield* loadProjectColumns(options.project);
    const counts = yield* withSpinner("Counting tasks")(
      Effect.forEach(
        columns,
        (column) => countColumnTasks(project.id, column.slug),
        { concurrency: 4 },
      ),
    );
    const json = columns.map((column, index) =>
      toColumnJson(column, counts[index] ?? null),
    );

    yield* emit(json, (ui) =>
      renderColumnList(ui, {
        projectName: project.name,
        projectSlug: project.slug,
        projectUrl: projectUrl(session.webUrl, project),
        columns: json,
      }),
    );
  },
);

export const columnList = Command.make(
  "list",
  { project: projectFlag },
  (options) => runColumnList(options),
).pipe(
  Command.withDescription("List a project's columns in board order"),
  Command.provide(ApiLayer),
);
