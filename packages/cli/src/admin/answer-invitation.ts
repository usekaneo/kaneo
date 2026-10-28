import { Effect, Option } from "effect";
import {
  acceptInvitation,
  getInvitationDetails,
  listReceivedInvitations,
  rejectInvitation,
} from "../api/invitations.js";
import { listOrganizations } from "../api/workspace-admin.js";
import { InvalidArgument } from "../errors/errors.js";
import { emit } from "../output/emit.js";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { pick } from "../prompts/pick.js";
import { renderInvitationAnswer } from "./render-invitation-change.js";

const notPending = (id: string) =>
  new InvalidArgument({
    message: `No pending invitation ${id} for your account.`,
    hint: "It may have expired, been canceled, or been answered already. Run kaneo invitation pending to see yours.",
  });

export const answerInvitation = Effect.fnUntraced(function* (
  reference: Option.Option<string>,
  accept: boolean,
) {
  const output = yield* Output;
  const verb = accept ? "accept" : "decline";
  if (Option.isNone(reference) && !output.interactive) {
    return yield* new InvalidArgument({
      message: `Which invitation should be ${accept ? "accepted" : "declined"}?`,
      hint: `Pass its id, for example kaneo invitation ${verb} <id>. Run kaneo invitation pending to see them.`,
    });
  }
  const received = yield* withSpinner("Loading invitations")(
    listReceivedInvitations(),
  );
  const id = Option.isSome(reference)
    ? reference.value.trim()
    : received.length > 0
      ? yield* pick(
          accept ? "Accept which invitation?" : "Decline which invitation?",
          received.map((invitation) => ({
            title: invitation.workspaceName,
            value: invitation.id,
            description: `from ${invitation.inviterName}`,
          })),
        )
      : yield* new InvalidArgument({
          message: "You have no pending invitations.",
        });
  const known = received.find((invitation) => invitation.id === id);
  const details = yield* withSpinner("Loading the invitation")(
    getInvitationDetails(id),
  );
  if (!details.valid) {
    return yield* new InvalidArgument({
      message: `${details.error ?? "This invitation can no longer be used"}.`,
      hint: "Run kaneo invitation pending to see the invitations you can answer.",
    });
  }

  const answer = yield* withSpinner(
    accept ? "Accepting the invitation" : "Declining the invitation",
  )(accept ? acceptInvitation(id) : rejectInvitation(id)).pipe(
    Effect.catchTags({
      InvalidRequest: (error) =>
        Effect.fail(
          /invitation not found/i.test(error.message) ? notPending(id) : error,
        ),
      PermissionDenied: (error) =>
        Effect.fail(
          /not the recipient/i.test(error.message)
            ? new InvalidArgument({
                message: "This invitation was sent to another email address.",
                hint: "Sign in with the invited account, then try again.",
              })
            : error,
        ),
    }),
  );

  const workspaceId =
    known?.workspaceId ?? answer.invitation?.organizationId ?? null;
  const joined =
    accept && workspaceId
      ? yield* listOrganizations().pipe(
          Effect.map((organizations) =>
            organizations.find(
              (organization) => organization.id === workspaceId,
            ),
          ),
          Effect.orElseSucceed(() => undefined),
        )
      : undefined;
  const workspaceName =
    known?.workspaceName ??
    details.invitation?.workspaceName ??
    joined?.name ??
    null;

  yield* emit(
    {
      id,
      workspaceId,
      workspaceName,
      ...(accept ? { accepted: true } : { declined: true }),
    },
    (ui) =>
      renderInvitationAnswer(ui, {
        accepted: accept,
        workspaceName,
        next: joined
          ? `Run kaneo workspace use ${joined.slug} to switch to it.`
          : null,
      }),
  );
});
