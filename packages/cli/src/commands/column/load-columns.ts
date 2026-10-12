import { Effect, Option } from "effect";
import { listColumnDetails } from "../../api/columns.js";
import { withSpinner } from "../../output/spinner.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";

export const loadProjectColumns = Effect.fnUntraced(function* (
  project: Option.Option<string>,
) {
  const workspaceId = yield* resolveWorkspaceId();
  const resolved = yield* resolveProject(workspaceId, project);
  const columns = yield* withSpinner(`Loading ${resolved.name} columns`)(
    listColumnDetails(resolved.id),
  );
  return { project: resolved, columns };
});
