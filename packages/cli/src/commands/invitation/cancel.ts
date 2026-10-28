import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  isPending,
  toSentInvitationJson,
} from "../../admin/invitation-json.js";
import { renderInvitationCanceled } from "../../admin/render-invitation-change.js";
import { roleLabel } from "../../admin/roles.js";
import {
  cancelInvitation,
  listSentInvitations,
} from "../../api/invitations.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { pick } from "../../prompts/pick.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

export const runInvitationCancel = Effect.fn("command.invitation.cancel")(
  function* (options: {
    readonly invitation: Option.Option<string>;
    readonly yes: boolean;
  }) {
    const session = yield* Session;
    const output = yield* Output;
    if (Option.isNone(options.invitation) && !output.interactive) {
      return yield* new InvalidArgument({
        message: "Which invitation should be canceled?",
        hint: "Pass its id or email address. Run kaneo invitation list to see them.",
      });
    }
    const workspaceId = yield* resolveWorkspaceId();
    const now = new Date();
    const pending = (yield* withSpinner("Loading invitations")(
      listSentInvitations(workspaceId),
    ))
      .map((invitation) => toSentInvitationJson(invitation, session.webUrl))
      .filter((invitation) => isPending(invitation, now));

    const wanted = Option.map(options.invitation, (value) => value.trim());
    const target = Option.isSome(wanted)
      ? pending.find(
          (invitation) =>
            invitation.id === wanted.value ||
            invitation.email === wanted.value.toLowerCase(),
        )
      : pending.length > 0
        ? yield* pick(
            "Cancel which invitation?",
            pending.map((invitation) => ({
              title: invitation.email,
              value: invitation,
              description: roleLabel(invitation.role),
            })),
          )
        : undefined;
    if (!target) {
      return yield* new InvalidArgument({
        message: Option.isSome(wanted)
          ? `No pending invitation matches "${wanted.value}" in this workspace.`
          : "This workspace has no pending invitations.",
        hint: "Run kaneo invitation list to see the pending ones.",
      });
    }

    yield* confirmDestructive({
      yes: options.yes,
      action: `Canceling the invitation for ${target.email}`,
      question: `Cancel the invitation for ${target.email}? Its link stops working.`,
    });

    yield* withSpinner(`Canceling the invitation for ${target.email}`)(
      cancelInvitation(target.id),
    );
    yield* emit(
      { ...target, status: "canceled", canceled: true },
      renderInvitationCanceled,
    );
  },
);

export const invitationCancel = Command.make(
  "cancel",
  {
    invitation: Argument.String("invitation").pipe(
      Argument.withDescription(
        "Invitation id or invited email address; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Cancel without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runInvitationCancel(options),
).pipe(
  Command.withDescription("Cancel a pending invitation you sent"),
  Command.provide(ApiLayer),
);
