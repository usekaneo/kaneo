import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const WorkflowRule = Schema.Struct({
  id: Schema.String,
  integrationType: Schema.String,
  eventType: Schema.String,
  columnId: Schema.String,
  columnName: NullableString,
  columnSlug: NullableString,
});
export type WorkflowRule = typeof WorkflowRule.Type;

const WorkflowRuleList = Schema.Array(WorkflowRule);

const SavedRule = Schema.Struct({
  id: Schema.String,
  integrationType: Schema.String,
  eventType: Schema.String,
  columnId: Schema.String,
});

function rulePath(id: string): string {
  return `/api/workflow-rule/${encodeURIComponent(id)}`;
}

export const listWorkflowRules = Effect.fnUntraced(function* (
  projectId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", rulePath(projectId), WorkflowRuleList);
});

export const upsertWorkflowRule = Effect.fnUntraced(function* (
  projectId: string,
  body: {
    readonly integrationType: string;
    readonly eventType: string;
    readonly columnId: string;
  },
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", rulePath(projectId), SavedRule, { body });
});

export const deleteWorkflowRule = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request("DELETE", rulePath(id), SavedRule);
});
