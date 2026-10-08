import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const OptionalString = Schema.optionalKey(Schema.String);

export const SearchHit = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  title: Schema.String,
  description: OptionalString,
  content: OptionalString,
  projectId: OptionalString,
  projectName: OptionalString,
  projectSlug: OptionalString,
  workspaceId: OptionalString,
  userName: OptionalString,
  createdAt: Schema.String,
  relevanceScore: Schema.Number,
  taskNumber: Schema.optionalKey(Schema.Number),
  priority: OptionalString,
  status: OptionalString,
});
export type SearchHit = typeof SearchHit.Type;

export const SearchResponse = Schema.Struct({
  results: Schema.Array(SearchHit),
  totalCount: Schema.Number,
});
export type SearchResponse = typeof SearchResponse.Type;

export const SEARCH_TYPES = [
  "all",
  "tasks",
  "projects",
  "workspaces",
  "comments",
  "activities",
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const searchWorkspace = Effect.fnUntraced(function* (params: {
  readonly query: string;
  readonly workspaceId: string;
  readonly type: SearchType;
  readonly projectId: string | undefined;
  readonly limit: number;
}) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/search", SearchResponse, {
    query: {
      q: params.query,
      type: params.type,
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      limit: params.limit,
    },
  });
});
