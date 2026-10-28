import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import type { ColumnRef } from "../tasks/match-column.js";
import { findColumn } from "./find-column.js";

export type MoveRequest = {
  readonly column: string;
  readonly before: string | undefined;
  readonly after: string | undefined;
};

export type MovePlan<C> = {
  readonly moved: C;
  readonly anchor: C;
  readonly placement: "before" | "after";
  readonly order: ReadonlyArray<C>;
  readonly changed: boolean;
};

export type Placement = {
  readonly placement: "before" | "after";
  readonly anchor: string;
};

export function parsePlacement(
  request: Pick<MoveRequest, "before" | "after">,
): Result.Result<Placement, InvalidArgument> {
  if (request.before !== undefined && request.after === undefined) {
    return Result.succeed({ placement: "before", anchor: request.before });
  }
  if (request.after !== undefined && request.before === undefined) {
    return Result.succeed({ placement: "after", anchor: request.after });
  }
  return Result.fail(
    new InvalidArgument({
      message: "Say where the column goes.",
      hint: "Pass exactly one of --before <column> or --after <column>.",
    }),
  );
}

export function planColumnMove<C extends ColumnRef & { readonly id: string }>(
  columns: ReadonlyArray<C>,
  request: MoveRequest,
): Result.Result<MovePlan<C>, InvalidArgument> {
  const parsed = parsePlacement(request);
  if (Result.isFailure(parsed)) return Result.fail(parsed.failure);
  const { placement, anchor: anchorReference } = parsed.success;
  return Result.flatMap(findColumn(columns, request.column), (moved) =>
    Result.flatMap(
      findColumn(columns, anchorReference, `--${placement}`),
      (anchor) => {
        if (anchor.id === moved.id) {
          return Result.fail(
            new InvalidArgument({
              message: `Cannot move ${moved.name} ${placement} itself.`,
              hint: `Pick another column for --${placement}.`,
            }),
          );
        }
        const rest = columns.filter((column) => column.id !== moved.id);
        const index = rest.findIndex((column) => column.id === anchor.id);
        const at = placement === "before" ? index : index + 1;
        const order = [...rest.slice(0, at), moved, ...rest.slice(at)];
        return Result.succeed({
          moved,
          anchor,
          placement,
          order,
          changed: order.some((column, i) => column.id !== columns[i]?.id),
        });
      },
    ),
  );
}
