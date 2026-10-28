import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { invitationUrl } from "../../admin/invitation-json.js";
import { parseEmails } from "../../admin/parse-emails.js";
import {
  type InviteJson,
  renderInvites,
} from "../../admin/render-invitation-change.js";
import { resolveRole } from "../../admin/resolve-role.js";
import { inviteMember, listSentInvitations } from "../../api/invitations.js";
import { listOrganizationMembers } from "../../api/members.js";
import { describeError } from "../../errors/describe.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit, note } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

const EMAIL_FAILED = /email delivery failed/i;

export const runMemberInvite = Effect.fn("command.member.invite")(
  function* (options: {
    readonly emails: ReadonlyArray<string>;
    readonly role: string;
  }) {
    const session = yield* Session;
    const emails = yield* Effect.fromResult(parseEmails(options.emails));
    const workspaceId = yield* resolveWorkspaceId();
    const role = yield* resolveRole(workspaceId, Option.some(options.role), {
      question: "Invite as",
      example: "--role admin",
    });
    const [members, sent] = yield* withSpinner("Loading members")(
      Effect.all(
        [
          listOrganizationMembers(workspaceId),
          listSentInvitations(workspaceId),
        ],
        { concurrency: 2 },
      ),
    );
    const memberEmails = new Set(
      members.map((member) => member.user.email.toLowerCase()),
    );
    const already = emails.filter((email) => memberEmails.has(email));
    if (already.length > 0) {
      return yield* new InvalidArgument({
        message:
          already.length === 1
            ? `${already[0]} is already a member of this workspace.`
            : `Already members of this workspace: ${already.join(", ")}.`,
        hint: "Run kaneo member role to change what a member can do.",
      });
    }
    const pending = new Set(
      sent
        .filter((invitation) => invitation.status === "pending")
        .map((invitation) => invitation.email.toLowerCase()),
    );

    const invites: InviteJson[] = [];
    for (const email of emails) {
      const resent = pending.has(email);
      const result = yield* withSpinner(`Inviting ${email}`)(
        inviteMember({ workspaceId, email, role, resend: resent }),
      ).pipe(
        Effect.map((invitation) => ({
          id: invitation.id as string | null,
          role: invitation.role,
          emailSent: true,
        })),
        Effect.catchTag("ServerError", (error) =>
          error.status === 502 && EMAIL_FAILED.test(error.message)
            ? Effect.succeed({
                id: null as string | null,
                role,
                emailSent: false,
              })
            : Effect.fail(error),
        ),
        Effect.result,
      );
      if (result._tag === "Failure") {
        if (invites.length === 0) return yield* Effect.fail(result.failure);
        const reason = describeError(result.failure).message;
        return yield* new InvalidArgument({
          message: `Invited ${invites.map((invite) => invite.email).join(", ")}, then ${email} failed: ${reason}`,
          hint: "Run the command again with the addresses that were not invited yet.",
        });
      }
      invites.push({
        id: result.success.id,
        email,
        role: result.success.role,
        resent,
        emailSent: result.success.emailSent,
        url: result.success.id
          ? invitationUrl(session.webUrl, result.success.id)
          : null,
      });
    }

    const missing = invites.filter((invite) => invite.id === null);
    const completed =
      missing.length === 0
        ? invites
        : yield* listSentInvitations(workspaceId).pipe(
            Effect.map((latest) =>
              invites.map((invite) => {
                if (invite.id !== null) return invite;
                const found = latest.find(
                  (invitation) =>
                    invitation.status === "pending" &&
                    invitation.email.toLowerCase() === invite.email,
                );
                return found
                  ? {
                      ...invite,
                      id: found.id,
                      url: invitationUrl(session.webUrl, found.id),
                    }
                  : invite;
              }),
            ),
          );

    yield* emit(completed, renderInvites);
    const kept = completed.filter((invite) => invite.role !== role);
    if (kept.length > 0) {
      yield* note((ui) => [
        `  ${ui.theme.warning(ui.glyphs.warning)} A resent invitation keeps its original role. To change it, run kaneo invitation cancel <id>, then invite again.`,
        "",
      ]);
    }
  },
);

export const memberInvite = Command.make(
  "invite",
  {
    emails: Argument.String("email").pipe(
      Argument.withDescription("One or more email addresses to invite"),
      Argument.atLeast(1),
    ),
    role: Flag.String("role").pipe(
      Flag.withAlias("r"),
      Flag.withDescription(
        "Role for the new members: owner, admin, member, viewer, or a custom role",
      ),
      Flag.withDefault("member"),
    ),
  },
  (options) => runMemberInvite(options),
).pipe(
  Command.withDescription("Invite people to the workspace by email"),
  Command.provide(ApiLayer),
);
