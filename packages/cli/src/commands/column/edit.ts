import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  type ColumnDetail,
  type UpdateColumnBody,
  updateColumn,
} from "../../api/columns.js";
import { toColumnJson } from "../../columns/column-json.js";
import { findColumn } from "../../columns/find-column.js";
import { parseColor } from "../../columns/parse-color.js";
import { renderColumnChange } from "../../columns/render-column-change.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { ApiLayer } from "../api-layer.js";
import { loadProjectColumns } from "./load-columns.js";
import { projectFlag } from "./project-flag.js";

function describeChanges(
  before: ColumnDetail,
  body: UpdateColumnBody,
): string[] {
  const details: string[] = [];
  if (body.name !== undefined && body.name !== before.name) {
    details.push(`renamed from ${before.name}`);
  }
  if (body.isFinal !== undefined && body.isFinal !== before.isFinal) {
    details.push(body.isFinal ? "now final" : "no longer final");
  }
  if (body.color !== undefined && body.color !== before.color) {
    details.push(body.color === null ? "color cleared" : `color ${body.color}`);
  }
  if (body.icon !== undefined && body.icon !== before.icon) {
    details.push(body.icon === null ? "icon cleared" : `icon ${body.icon}`);
  }
  return details.length > 0 ? details : ["no changes"];
}

export const runColumnEdit = Effect.fn("command.column.edit")(
  function* (options: {
    readonly column: string;
    readonly project: Option.Option<string>;
    readonly name: Option.Option<string>;
    readonly final: Option.Option<boolean>;
    readonly color: Option.Option<string>;
    readonly icon: Option.Option<string>;
  }) {
    const name = Option.getOrUndefined(options.name)?.trim();
    if (name === "") {
      return yield* new InvalidArgument({
        message: "--name cannot be empty.",
      });
    }
    const color = Option.isSome(options.color)
      ? yield* Effect.fromResult(parseColor(options.color.value))
      : undefined;
    const iconInput = Option.getOrUndefined(options.icon)?.trim();
    const icon =
      iconInput === undefined
        ? undefined
        : iconInput === "" || iconInput.toLowerCase() === "none"
          ? null
          : iconInput;
    const body: UpdateColumnBody = {
      ...(name === undefined ? {} : { name }),
      ...(Option.isSome(options.final) ? { isFinal: options.final.value } : {}),
      ...(color === undefined ? {} : { color }),
      ...(icon === undefined ? {} : { icon }),
    };
    if (Object.keys(body).length === 0) {
      return yield* new InvalidArgument({
        message: "Nothing to change.",
        hint: "Pass --name, --final or --no-final, --color, or --icon.",
      });
    }

    const { columns } = yield* loadProjectColumns(options.project);
    const column = yield* Effect.fromResult(
      findColumn(columns, options.column),
    );
    const updated = yield* withSpinner(`Updating ${column.name}`)(
      updateColumn(column.id, body),
    );

    yield* emit(toColumnJson(updated, null), (ui) =>
      renderColumnChange(ui, {
        verb: "Updated",
        column: updated,
        details: describeChanges(column, body),
      }),
    );
  },
);

export const columnEdit = Command.make(
  "edit",
  {
    column: Argument.String("column").pipe(
      Argument.withDescription("Column slug, name or id"),
    ),
    project: projectFlag,
    name: Flag.String("name").pipe(
      Flag.withDescription("New name; the slug and its tasks stay the same"),
      Flag.optional,
    ),
    final: Flag.Boolean("final").pipe(
      Flag.withDescription("Mark as a done column (--no-final to unmark it)"),
      Flag.optional,
    ),
    color: Flag.String("color").pipe(
      Flag.withDescription("Hex color such as #3b82f6, or none to clear it"),
      Flag.optional,
    ),
    icon: Flag.String("icon").pipe(
      Flag.withDescription("Lucide icon name, or none to clear it"),
      Flag.optional,
    ),
  },
  (options) => runColumnEdit(options),
).pipe(
  Command.withDescription(
    "Rename a column, or change its done state, color or icon",
  ),
  Command.provide(ApiLayer),
);
