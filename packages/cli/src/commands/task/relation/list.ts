import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { listProjects } from "../../../api/endpoints.js";
import { listTaskRelations } from "../../../api/task-relations.js";
import { emit } from "../../../output/emit.js";
import { withSpinner } from "../../../output/spinner.js";
import { groupRelations } from "../../../relations/group-relations.js";
import { renderRelationList } from "../../../relations/render-relation-list.js";
import { Session } from "../../../services/session.js";
import { resolveTask } from "../../../tasks/resolve-task.js";
import { ApiLayer } from "../../api-layer.js";

export const runRelationList = Effect.fn("command.task.relation.list")(
  function* (options: { readonly task: string }) {
    const session = yield* Session;
    const { resolved, relations, projects } = yield* withSpinner(
      `Loading relations of ${options.task}`,
    )(
      Effect.gen(function* () {
        const resolved = yield* resolveTask(options.task);
        const [relations, projects] = yield* Effect.all(
          [
            listTaskRelations(resolved.task.id),
            listProjects(resolved.workspaceId),
          ],
          { concurrency: 2 },
        );
        return { resolved, relations, projects };
      }),
    );
    const json = groupRelations(relations, resolved.task.id, {
      projectSlugs: new Map(
        projects.map((project) => [project.id, project.slug]),
      ),
      workspaceId: resolved.workspaceId,
      webUrl: session.webUrl,
    });

    yield* emit(json, (ui, value) =>
      renderRelationList(ui, {
        label: resolved.ticketId ?? resolved.task.id.slice(0, 8),
        title: resolved.task.title,
        url: resolved.url,
        relations: value,
      }),
    );
  },
);

export const relationList = Command.make(
  "list",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
  },
  (options) => runRelationList(options),
).pipe(
  Command.withDescription(
    "Show the parent, subtasks and linked tasks of a task",
  ),
  Command.provide(ApiLayer),
);
