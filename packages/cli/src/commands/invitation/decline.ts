import { Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";
import { answerInvitation } from "../../admin/answer-invitation.js";
import { ApiLayer } from "../api-layer.js";

export const runInvitationDecline = Effect.fn("command.invitation.decline")(
  function* (options: { readonly id: Option.Option<string> }) {
    yield* answerInvitation(options.id, false);
  },
);

export const invitationDecline = Command.make(
  "decline",
  {
    id: Argument.String("id").pipe(
      Argument.withDescription(
        "Invitation id; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
  },
  (options) => runInvitationDecline(options),
).pipe(
  Command.withDescription("Decline an invitation to a workspace"),
  Command.provide(ApiLayer),
);
