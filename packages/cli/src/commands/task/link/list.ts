import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { listExternalLinks } from "../../../api/external-links.js";
import { toLinkJson } from "../../../external-links/link-json.js";
import { renderLinkList } from "../../../external-links/render-link-list.js";
import { emit } from "../../../output/emit.js";
import { withSpinner } from "../../../output/spinner.js";
import { resolveTask } from "../../../tasks/resolve-task.js";
import { ApiLayer } from "../../api-layer.js";

export const runTaskLinkList = Effect.fn("command.task.link.list")(
  function* (options: { readonly task: string }) {
    const resolved = yield* withSpinner(`Loading ${options.task.trim()}`)(
      resolveTask(options.task),
    );
    const links = yield* withSpinner("Loading links")(
      listExternalLinks(resolved.task.id),
    );
    const json = links.map(toLinkJson);
    yield* emit(json, (ui) =>
      renderLinkList(ui, {
        taskLabel: resolved.ticketId ?? resolved.task.id.slice(0, 8),
        taskTitle: resolved.task.title,
        taskUrl: resolved.url,
        links: json,
      }),
    );
  },
);

export const taskLinkList = Command.make(
  "list",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
  },
  (options) => runTaskLinkList(options),
).pipe(
  Command.withDescription(
    "List a task's links, including issues and pull requests from integrations",
  ),
  Command.provide(ApiLayer),
);
