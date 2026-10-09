import { Effect, type Option } from "effect";
import { Argument, Command } from "effect/cli";
import { setArchived } from "../../projects-write/set-archived.js";
import { ApiLayer } from "../api-layer.js";

export const runProjectArchive = Effect.fn("command.project.archive")(
  function* (options: { readonly project: Option.Option<string> }) {
    yield* setArchived(options.project, true);
  },
);

export const projectArchive = Command.make(
  "archive",
  {
    project: Argument.String("project").pipe(
      Argument.withDescription(
        "Project key or id, for example KAN (default: the linked project)",
      ),
      Argument.optional,
    ),
  },
  (options) => runProjectArchive(options),
).pipe(
  Command.withDescription(
    "Hide a project from the project list without deleting it",
  ),
  Command.provide(ApiLayer),
);
