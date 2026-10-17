import { Result } from "effect";
import type { Column } from "../api/schemas.js";
import { InvalidArgument } from "../errors/errors.js";
import { matchColumn } from "../tasks/match-column.js";

export type ProjectColumns = {
  readonly name: string;
  readonly columns: ReadonlyArray<Column>;
};

function slugList(columns: ReadonlyArray<Column>): string {
  return [...columns]
    .sort((a, b) => a.position - b.position)
    .map((column) => column.slug)
    .join(", ");
}

export function resolveBulkStatus(
  projects: ReadonlyArray<ProjectColumns>,
  reference: string,
): Result.Result<Column, InvalidArgument> {
  let chosen: { readonly column: Column; readonly project: string } | null =
    null;
  for (const project of projects) {
    const match = matchColumn(project.columns, reference);
    if (!match) {
      return Result.fail(
        new InvalidArgument({
          message: `No column in ${project.name} matches "${reference}".`,
          hint: `Use one of: ${slugList(project.columns)}.`,
        }),
      );
    }
    if (chosen === null) {
      chosen = { column: match, project: project.name };
    } else if (chosen.column.slug !== match.slug) {
      return Result.fail(
        new InvalidArgument({
          message: `"${reference}" is ${chosen.column.slug} in ${chosen.project} but ${match.slug} in ${project.name}.`,
          hint: "Every task gets the same column slug, so pick tasks from projects that share it.",
        }),
      );
    }
  }
  return chosen === null
    ? Result.fail(new InvalidArgument({ message: "No tasks to change." }))
    : Result.succeed(chosen.column);
}
