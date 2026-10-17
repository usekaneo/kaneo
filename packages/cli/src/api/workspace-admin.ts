import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  description: Schema.optionalKey(NullableString),
  metadata: Schema.optionalKey(Schema.NullOr(Schema.Unknown)),
  createdAt: Schema.Unknown,
});
export type Organization = typeof Organization.Type;

const OrganizationList = Schema.Array(Organization);

const SlugCheck = Schema.Struct({ status: Schema.Boolean });

const Anything = Schema.Unknown;

export type WorkspaceChanges = {
  readonly name?: string;
  readonly slug?: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
};

export const listOrganizations = Effect.fnUntraced(function* () {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    "/api/auth/organization/list",
    OrganizationList,
  );
});

export const isWorkspaceSlugFree = Effect.fnUntraced(function* (slug: string) {
  const api = yield* KaneoApi;
  return yield* api
    .request("POST", "/api/auth/organization/check-slug", SlugCheck, {
      body: { slug },
    })
    .pipe(
      Effect.map((result) => result.status),
      Effect.catchTag("InvalidRequest", (error) =>
        /slug/i.test(error.message)
          ? Effect.succeed(false)
          : Effect.fail(error),
      ),
    );
});

export const createOrganization = Effect.fnUntraced(function* (body: {
  readonly name: string;
  readonly slug: string;
}) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    "/api/auth/organization/create",
    Organization,
    { body: { ...body, keepCurrentActiveOrganization: true } },
  );
});

export const updateOrganization = Effect.fnUntraced(function* (
  organizationId: string,
  data: WorkspaceChanges,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    "/api/auth/organization/update",
    Organization,
    { body: { organizationId, data } },
  );
});

export const deleteOrganization = Effect.fnUntraced(function* (
  organizationId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("POST", "/api/auth/organization/delete", Anything, {
    body: { organizationId },
  });
});

export const leaveOrganization = Effect.fnUntraced(function* (
  organizationId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("POST", "/api/auth/organization/leave", Anything, {
    body: { organizationId },
  });
});
