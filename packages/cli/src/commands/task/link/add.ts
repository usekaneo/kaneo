import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { createExternalLink } from "../../../api/external-links.js";
import {
  validateLinkTitle,
  validateLinkUrl,
} from "../../../external-links/link-input.js";
import { toLinkJson } from "../../../external-links/link-json.js";
import { renderLinkChange } from "../../../external-links/render-link-change.js";
import { emit } from "../../../output/emit.js";
import { withSpinner } from "../../../output/spinner.js";
import { resolveTask } from "../../../tasks/resolve-task.js";
import { ApiLayer } from "../../api-layer.js";

export const runTaskLinkAdd = Effect.fn("command.task.link.add")(
  function* (options: {
    readonly task: string;
    readonly url: string;
    readonly title: Option.Option<string>;
  }) {
    const url = yield* Effect.fromResult(validateLinkUrl(options.url));
    const title = yield* Option.match(options.title, {
      onNone: () => Effect.succeed(undefined),
      onSome: (value) => Effect.fromResult(validateLinkTitle(value)),
    });
    const resolved = yield* withSpinner(`Loading ${options.task.trim()}`)(
      resolveTask(options.task),
    );
    const label = resolved.ticketId ?? resolved.task.id.slice(0, 8);
    const link = yield* withSpinner(`Linking ${label}`)(
      createExternalLink(resolved.task.id, {
        url,
        ...(title === undefined ? {} : { title }),
      }),
    );
    yield* emit(
      {
        ...toLinkJson(link),
        taskId: resolved.task.id,
        ticketId: resolved.ticketId,
      },
      (ui, json) =>
        renderLinkChange(ui, {
          verb: "Linked",
          taskLabel: label,
          taskUrl: resolved.url,
          linkTitle: json.title ? `${json.title} (${json.url})` : json.url,
        }),
    );
  },
);

export const taskLinkAdd = Command.make(
  "add",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    url: Argument.String("url").pipe(
      Argument.withDescription("An http or https address"),
    ),
    title: Flag.String("title").pipe(
      Flag.withAlias("t"),
      Flag.withDescription("Text to show instead of the address"),
      Flag.optional,
    ),
  },
  (options) => runTaskLinkAdd(options),
).pipe(
  Command.withDescription("Attach a link to a task"),
  Command.provide(ApiLayer),
);
