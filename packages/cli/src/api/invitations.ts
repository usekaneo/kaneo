import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

export const SentInvitation = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  role: Schema.String,
  status: Schema.String,
  expiresAt: Schema.Unknown,
  createdAt: Schema.Unknown,
});
export type SentInvitation = typeof SentInvitation.Type;

const SentInvitationList = Schema.Array(SentInvitation);

export const ReceivedInvitation = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  workspaceId: Schema.String,
  workspaceName: Schema.String,
  inviterName: Schema.String,
  expiresAt: Schema.String,
});
export type ReceivedInvitation = typeof ReceivedInvitation.Type;

const ReceivedInvitationList = Schema.Array(ReceivedInvitation);

const InvitationAnswer = Schema.Struct({
  invitation: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({ organizationId: Schema.optionalKey(Schema.String) }),
    ),
  ),
});

const InvitationDetails = Schema.Struct({
  valid: Schema.Boolean,
  invitation: Schema.optionalKey(
    Schema.Struct({ workspaceName: Schema.String }),
  ),
  error: Schema.optionalKey(Schema.String),
});

const Anything = Schema.Unknown;

export const getInvitationDetails = Effect.fnUntraced(function* (
  invitationId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/invitation/${encodeURIComponent(invitationId)}`,
    InvitationDetails,
  );
});

export const listSentInvitations = Effect.fnUntraced(function* (
  workspaceId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    "/api/auth/organization/list-invitations",
    SentInvitationList,
    { query: { organizationId: workspaceId } },
  );
});

export const listReceivedInvitations = Effect.fnUntraced(function* () {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    "/api/invitation/pending",
    ReceivedInvitationList,
  );
});

export const inviteMember = Effect.fnUntraced(function* (body: {
  readonly workspaceId: string;
  readonly email: string;
  readonly role: string;
  readonly resend: boolean;
}) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    "/api/auth/organization/invite-member",
    SentInvitation,
    {
      body: {
        organizationId: body.workspaceId,
        email: body.email,
        role: body.role,
        ...(body.resend ? { resend: true } : {}),
      },
    },
  );
});

export const acceptInvitation = Effect.fnUntraced(function* (
  invitationId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    "/api/auth/organization/accept-invitation",
    InvitationAnswer,
    { body: { invitationId } },
  );
});

export const rejectInvitation = Effect.fnUntraced(function* (
  invitationId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    "/api/auth/organization/reject-invitation",
    InvitationAnswer,
    { body: { invitationId } },
  );
});

export const cancelInvitation = Effect.fnUntraced(function* (
  invitationId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    "/api/auth/organization/cancel-invitation",
    Anything,
    { body: { invitationId } },
  );
});
