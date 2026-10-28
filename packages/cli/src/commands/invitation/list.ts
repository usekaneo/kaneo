import { Effect } from "effect";
import { Command } from "effect/cli";
import {
  isPending,
  toSentInvitationJson,
} from "../../admin/invitation-json.js";
import { renderSentInvitations } from "../../admin/render-invitation-list.js";
import { listSentInvitations } from "../../api/invitations.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

export const runInvitationList = Effect.fn("command.invitation.list")(
  function* () {
    const session = yield* Session;
    const workspaceId = yield* resolveWorkspaceId();
    const invitations = yield* withSpinner("Loading invitations")(
      listSentInvitations(workspaceId),
    );
    const now = new Date();
    const pending = invitations
      .map((invitation) => toSentInvitationJson(invitation, session.webUrl))
      .filter((invitation) => isPending(invitation, now))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    yield* emit(pending, (ui, value) =>
      renderSentInvitations(ui, { invitations: value, now }),
    );
  },
);

export const invitationList = Command.make("list", {}, () =>
  runInvitationList(),
).pipe(
  Command.withDescription("List pending invitations sent from the workspace"),
  Command.provide(ApiLayer),
);
