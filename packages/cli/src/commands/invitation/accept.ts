import { Effect, Option } from "effect";
import { Argument, Command } from "effect/cli";
import { answerInvitation } from "../../admin/answer-invitation.js";
import { ApiLayer } from "../api-layer.js";

export const runInvitationAccept = Effect.fn("command.invitation.accept")(
  function* (options: { readonly id: Option.Option<string> }) {
    yield* answerInvitation(options.id, true);
  },
);

export const invitationAccept = Command.make(
  "accept",
  {
    id: Argument.String("id").pipe(
      Argument.withDescription(
        "Invitation id; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
  },
  (options) => runInvitationAccept(options),
).pipe(
  Command.withDescription("Accept an invitation and join the workspace"),
  Command.provide(ApiLayer),
);
