import { Effect } from "effect";
import { Command } from "effect/cli";
import { toReceivedInvitationJson } from "../../admin/invitation-json.js";
import { renderReceivedInvitations } from "../../admin/render-invitation-list.js";
import { listReceivedInvitations } from "../../api/invitations.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { ApiLayer } from "../api-layer.js";

export const runInvitationPending = Effect.fn("command.invitation.pending")(
  function* () {
    const invitations = yield* withSpinner("Loading invitations")(
      listReceivedInvitations(),
    );
    yield* emit(invitations.map(toReceivedInvitationJson), (ui, value) =>
      renderReceivedInvitations(ui, { invitations: value, now: new Date() }),
    );
  },
);

export const invitationPending = Command.make("pending", {}, () =>
  runInvitationPending(),
).pipe(
  Command.withDescription("List invitations to join other workspaces"),
  Command.provide(ApiLayer),
);
