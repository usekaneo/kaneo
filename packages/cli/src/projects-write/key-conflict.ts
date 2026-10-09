import { Effect } from "effect";
import { listProjectRecords } from "../api/project-writes.js";
import { type Conflict, InvalidArgument } from "../errors/errors.js";
import { suggestProjectKey } from "./project-key.js";

export function keyConflictHint(
  suggestion: string | undefined,
  retry: string | undefined,
): string {
  if (retry) {
    return `Give it another key first, for example ${retry} --key ${suggestion ?? "NEW"}.`;
  }
  return suggestion
    ? `Pick another key, for example --key ${suggestion}.`
    : "Pick another key with --key.";
}

export const explainKeyConflict = Effect.fnUntraced(function* (
  conflict: Conflict,
  options: {
    readonly workspaceId: string;
    readonly name: string;
    readonly key: string;
    readonly retry?: string;
  },
) {
  const projects = yield* listProjectRecords(options.workspaceId).pipe(
    Effect.orElseSucceed(() => []),
  );
  const suggestion = suggestProjectKey(
    options.name,
    options.key,
    projects.map((project) => project.slug),
  );
  return yield* new InvalidArgument({
    message: conflict.message,
    hint: keyConflictHint(suggestion, options.retry),
  });
});
