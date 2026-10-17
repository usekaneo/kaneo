import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  deleteExternalLink,
  listExternalLinks,
} from "../../../api/external-links.js";
import { InvalidArgument } from "../../../errors/errors.js";
import { isManualLink, toLinkJson } from "../../../external-links/link-json.js";
import { matchLink } from "../../../external-links/match-link.js";
import { renderLinkChange } from "../../../external-links/render-link-change.js";
import { emit } from "../../../output/emit.js";
import { withSpinner } from "../../../output/spinner.js";
import { confirmDestructive } from "../../../prompts/confirm-destructive.js";
import { resolveTask } from "../../../tasks/resolve-task.js";
import { ApiLayer } from "../../api-layer.js";

export const runTaskLinkRemove = Effect.fn("command.task.link.remove")(
  function* (options: {
    readonly task: string;
    readonly link: string;
    readonly yes: boolean;
  }) {
    const resolved = yield* withSpinner(`Loading ${options.task.trim()}`)(
      resolveTask(options.task),
    );
    const label = resolved.ticketId ?? resolved.task.id.slice(0, 8);
    const links = yield* withSpinner("Loading links")(
      listExternalLinks(resolved.task.id),
    );
    const match = matchLink(links, options.link);
    if (match.kind === "none") {
      return yield* new InvalidArgument({
        message: `${label} has no link matching "${options.link.trim()}".`,
        hint: `Run kaneo task link list ${label} to see the link ids.`,
      });
    }
    if (match.kind === "ambiguous") {
      return yield* new InvalidArgument({
        message: `"${options.link.trim()}" matches ${match.candidates.length} links on ${label}.`,
        hint: `Pass the full id: ${match.candidates.map((link) => link.id).join(", ")}.`,
      });
    }
    const link = match.link;
    if (!isManualLink(link)) {
      return yield* new InvalidArgument({
        message: `This link comes from the ${link.integration?.type ?? "connected"} integration, so it cannot be removed here.`,
        hint: "Remove it on the integration's side, or disconnect the integration.",
      });
    }
    const name = link.title ?? link.url;
    yield* confirmDestructive({
      yes: options.yes,
      action: `Removing the link from ${label}`,
      question: `Remove ${name} from ${label}?`,
    });
    yield* withSpinner(`Removing the link from ${label}`)(
      deleteExternalLink(resolved.task.id, link.id),
    );
    yield* emit(
      {
        ...toLinkJson(link),
        taskId: resolved.task.id,
        ticketId: resolved.ticketId,
        removed: true,
      },
      (ui) =>
        renderLinkChange(ui, {
          verb: "Unlinked",
          taskLabel: label,
          taskUrl: resolved.url,
          linkTitle: name,
        }),
    );
  },
);

export const taskLinkRemove = Command.make(
  "remove",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    link: Argument.String("link").pipe(
      Argument.withDescription(
        "Link id from kaneo task link list (the first characters are enough), or its URL",
      ),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Remove without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runTaskLinkRemove(options),
).pipe(
  Command.withDescription("Remove a link you added from a task"),
  Command.provide(ApiLayer),
);
