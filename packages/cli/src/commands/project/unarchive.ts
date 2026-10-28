import { Effect, type Option } from "effect";
import { Argument, Command } from "effect/cli";
import { setArchived } from "../../projects-write/set-archived.js";
import { ApiLayer } from "../api-layer.js";

export const runProjectUnarchive = Effect.fn("command.project.unarchive")(
  function* (options: { readonly project: Option.Option<string> }) {
    yield* setArchived(options.project, false);
  },
);

export const projectUnarchive = Command.make(
  "unarchive",
  {
    project: Argument.String("project").pipe(
      Argument.withDescription("Archived project key or id, for example KAN"),
      Argument.optional,
    ),
  },
  (options) => runProjectUnarchive(options),
).pipe(
  Command.withDescription("Bring an archived project back to the project list"),
  Command.provide(ApiLayer),
);
