import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { type ColumnRef, matchColumn } from "../tasks/match-column.js";

export function findColumn<C extends ColumnRef>(
  columns: ReadonlyArray<C>,
  reference: string,
  flag?: string,
): Result.Result<C, InvalidArgument> {
  const match = matchColumn(columns, reference);
  if (match) return Result.succeed(match);
  const slugs = columns.map((column) => column.slug).join(", ");
  return Result.fail(
    new InvalidArgument({
      message: `${flag ? `${flag} ` : ""}"${reference}" does not match a column in this project.`,
      hint: slugs ? `Columns: ${slugs}.` : "This project has no columns yet.",
    }),
  );
}
