import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { reorderColumns } from "../../api/columns.js";
import { toColumnJson } from "../../columns/column-json.js";
import {
  parsePlacement,
  planColumnMove,
} from "../../columns/plan-column-move.js";
import { renderColumnChange } from "../../columns/render-column-change.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { ApiLayer } from "../api-layer.js";
import { loadProjectColumns } from "./load-columns.js";
import { projectFlag } from "./project-flag.js";

export const runColumnMove = Effect.fn("command.column.move")(
  function* (options: {
    readonly column: string;
    readonly project: Option.Option<string>;
    readonly before: Option.Option<string>;
    readonly after: Option.Option<string>;
  }) {
    const request = {
      column: options.column,
      before: Option.getOrUndefined(options.before),
      after: Option.getOrUndefined(options.after),
    };
    yield* Effect.fromResult(parsePlacement(request));
    const { project, columns } = yield* loadProjectColumns(options.project);
    const plan = yield* Effect.fromResult(planColumnMove(columns, request));
    const ordered = plan.changed
      ? yield* withSpinner(`Moving ${plan.moved.name}`)(
          reorderColumns(
            project.id,
            plan.order.map((column, position) => ({ id: column.id, position })),
          ),
        )
      : columns;

    yield* emit(
      ordered.map((column) => toColumnJson(column, null)),
      (ui) =>
        renderColumnChange(ui, {
          verb: "Moved",
          column: plan.moved,
          details: [
            `${plan.changed ? "" : "already "}${plan.placement} ${plan.anchor.name}`,
          ],
        }),
    );
  },
);

export const columnMove = Command.make(
  "move",
  {
    column: Argument.String("column").pipe(
      Argument.withDescription("Column slug, name or id"),
    ),
    project: projectFlag,
    before: Flag.String("before").pipe(
      Flag.withDescription("Put it just before this column"),
      Flag.optional,
    ),
    after: Flag.String("after").pipe(
      Flag.withDescription("Put it just after this column"),
      Flag.optional,
    ),
  },
  (options) => runColumnMove(options),
).pipe(
  Command.withDescription("Move a column before or after another one"),
  Command.provide(ApiLayer),
);
