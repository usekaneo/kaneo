import { Effect } from "effect";
import { type Label, listWorkspaceLabels } from "../api/labels.js";
import { pickLabels } from "./pick-labels.js";

export const resolveLabels = Effect.fn("labels.resolve")(function* (
  workspaceId: string,
  names: ReadonlyArray<string>,
) {
  if (names.length === 0) return [] as ReadonlyArray<Label>;
  const labels = yield* listWorkspaceLabels(workspaceId);
  return yield* Effect.fromResult(pickLabels(labels, names));
});
