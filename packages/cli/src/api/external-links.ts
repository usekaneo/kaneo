import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const ExternalLink = Schema.Struct({
  id: Schema.String,
  taskId: Schema.String,
  integrationId: NullableString,
  resourceType: Schema.String,
  url: Schema.String,
  title: NullableString,
  createdAt: Schema.String,
  integration: Schema.optionalKey(
    Schema.NullOr(Schema.Struct({ id: Schema.String, type: Schema.String })),
  ),
});
export type ExternalLink = typeof ExternalLink.Type;

const ExternalLinkList = Schema.Array(ExternalLink);

const DeletedLink = Schema.Struct({ id: Schema.String });

function linksPath(taskId: string, suffix = ""): string {
  return `/api/external-link/task/${encodeURIComponent(taskId)}${suffix}`;
}

export const listExternalLinks = Effect.fnUntraced(function* (taskId: string) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", linksPath(taskId), ExternalLinkList);
});

export const createExternalLink = Effect.fnUntraced(function* (
  taskId: string,
  body: { readonly url: string; readonly title?: string },
) {
  const api = yield* KaneoApi;
  return yield* api.request("POST", linksPath(taskId), ExternalLink, { body });
});

export const deleteExternalLink = Effect.fnUntraced(function* (
  taskId: string,
  linkId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "DELETE",
    linksPath(taskId, `/${encodeURIComponent(linkId)}`),
    DeletedLink,
  );
});
