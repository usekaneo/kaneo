import { Command } from "effect/cli";
import { invitationAccept } from "./accept.js";
import { invitationCancel } from "./cancel.js";
import { invitationDecline } from "./decline.js";
import { invitationList } from "./list.js";
import { invitationPending } from "./pending.js";

export const invitation = Command.make("invitation").pipe(
  Command.withDescription("Manage workspace invitations"),
  Command.withSubcommands([
    invitationList,
    invitationPending,
    invitationAccept,
    invitationDecline,
    invitationCancel,
  ]),
);
