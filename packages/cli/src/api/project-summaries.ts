import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const ProjectSummary = Schema.Struct({
  id: Schema.String,
  workspaceId: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  description: NullableString,
  archivedAt: NullableString,
  statistics: Schema.Struct({
    totalTasks: Schema.Number,
    completionPercentage: Schema.Number,
    dueDate: NullableString,
  }),
});
export type ProjectSummary = typeof ProjectSummary.Type;

export const ProjectSummaryList = Schema.Array(ProjectSummary);

export const listProjectSummaries = Effect.fnUntraced(function* (
  workspaceId: string,
  options: { readonly includeArchived: boolean },
) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/project", ProjectSummaryList, {
    query: {
      workspaceId,
      includeArchived: options.includeArchived ? "true" : undefined,
    },
  });
});
