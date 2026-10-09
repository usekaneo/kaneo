import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { chooseMember } from "../../admin/choose-member.js";
import { toMemberJson } from "../../admin/member-json.js";
import { renderMemberRole } from "../../admin/render-member-change.js";
import { resolveRole } from "../../admin/resolve-role.js";
import { hasRole, isDemotion, roleLabel } from "../../admin/roles.js";
import { getCurrentUser } from "../../api/endpoints.js";
import {
  listOrganizationMembers,
  updateOrganizationMemberRole,
} from "../../api/members.js";
import { InvalidArgument, PermissionDenied } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

export const runMemberRole = Effect.fn("command.member.role")(
  function* (options: {
    readonly member: Option.Option<string>;
    readonly role: Option.Option<string>;
    readonly yes: boolean;
  }) {
    const workspaceId = yield* resolveWorkspaceId();
    const [members, me] = yield* withSpinner("Loading members")(
      Effect.all(
        [
          Effect.map(listOrganizationMembers(workspaceId), (list) =>
            list.map(toMemberJson),
          ),
          getCurrentUser(),
        ],
        { concurrency: 2 },
      ),
    );
    const target = yield* chooseMember(members, options.member, {
      question: "Change the role of",
      example: "kaneo member role grace@example.com admin",
    });
    const role = yield* resolveRole(workspaceId, options.role, {
      question: `New role for ${target.name}`,
      example: `kaneo member role ${target.email} admin`,
    });
    const result = { ...target, role, previousRole: target.role };

    if (role !== target.role) {
      if (isDemotion(target.role, role)) {
        const self = target.id === me.id;
        yield* confirmDestructive({
          yes: options.yes,
          action: `Changing ${self ? "your own role" : `the role of ${target.name}`} from ${roleLabel(target.role)}`,
          question: self
            ? `Change your own role from ${roleLabel(target.role)} to ${roleLabel(role)}? You may lose access to workspace settings.`
            : `Change ${target.name} from ${roleLabel(target.role)} to ${roleLabel(role)}?`,
        });
      }
      const ownerChange = hasRole(target.role, "owner") || role === "owner";
      yield* withSpinner(`Updating ${target.name}`)(
        updateOrganizationMemberRole(workspaceId, target.memberId, role),
      ).pipe(
        Effect.catchTags({
          InvalidRequest: (error) =>
            Effect.fail(
              /without an owner/i.test(error.message)
                ? new InvalidArgument({
                    message: "The workspace needs at least one owner.",
                    hint: "Make another member an owner first with kaneo member role <member> owner.",
                  })
                : error,
            ),
          PermissionDenied: (error) =>
            Effect.fail(
              /not allowed to update this member/i.test(error.message)
                ? new PermissionDenied({
                    message: ownerChange
                      ? "Only an owner can change an owner's role or make someone an owner."
                      : "You are not allowed to change roles in this workspace.",
                    missingPermissions: ownerChange ? [] : ["member:update"],
                  })
                : error,
            ),
        }),
      );
    }

    yield* emit(result, renderMemberRole);
  },
);

export const memberRole = Command.make(
  "role",
  {
    member: Argument.String("member").pipe(
      Argument.withDescription(
        "Email address, name or id; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    role: Argument.String("role").pipe(
      Argument.withDescription(
        "owner, admin, member, viewer, or a custom role of the workspace",
      ),
      Argument.optional,
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription(
        "Demote an owner or admin without asking for confirmation",
      ),
      Flag.withDefault(false),
    ),
  },
  (options) => runMemberRole(options),
).pipe(
  Command.withDescription("Change the role of a workspace member"),
  Command.provide(ApiLayer),
);
