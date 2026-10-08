import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export type Lookup<T> = {
  readonly reference: string;
  readonly task: T | null;
};

function list(values: ReadonlyArray<string>): string {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

export function checkFound<T extends { readonly id: string }>(
  lookups: ReadonlyArray<Lookup<T>>,
): Result.Result<T[], InvalidArgument> {
  const missing = lookups
    .filter((lookup) => lookup.task === null)
    .map((lookup) => lookup.reference.trim());
  if (missing.length > 0) {
    const unique = [...new Set(missing)];
    return Result.fail(
      new InvalidArgument({
        message:
          unique.length === 1
            ? `Task ${unique[0]} was not found, so nothing was changed.`
            : `Tasks ${list(unique)} were not found, so nothing was changed.`,
        hint: "Check the ticket ids, or run kaneo task list to see them.",
      }),
    );
  }
  const seen = new Set<string>();
  const tasks: T[] = [];
  for (const lookup of lookups) {
    if (lookup.task === null || seen.has(lookup.task.id)) continue;
    seen.add(lookup.task.id);
    tasks.push(lookup.task);
  }
  return Result.succeed(tasks);
}

export function checkSameWorkspace(
  tasks: ReadonlyArray<{ readonly workspaceId: string }>,
): Result.Result<string, InvalidArgument> {
  const workspaces = [...new Set(tasks.map((task) => task.workspaceId))];
  const [only] = workspaces;
  if (workspaces.length === 1 && only !== undefined) {
    return Result.succeed(only);
  }
  return Result.fail(
    new InvalidArgument({
      message: "The tasks belong to more than one workspace.",
      hint: "Run kaneo task bulk once per workspace.",
    }),
  );
}
