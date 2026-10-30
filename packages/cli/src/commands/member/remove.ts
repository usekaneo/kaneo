import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { chooseMember } from "../../admin/choose-member.js";
import { toMemberJson } from "../../admin/member-json.js";
import { renderMemberRemoved } from "../../admin/render-member-change.js";
import { hasRole } from "../../admin/roles.js";
import { getCurrentUser } from "../../api/endpoints.js";
import {
  hasWorkspacePermission,
  listOrganizationMembers,
  removeOrganizationMember,
} from "../../api/members.js";
import { InvalidArgument, PermissionDenied } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

export const runMemberRemove = Effect.fn("command.member.remove")(
  function* (options: {
    readonly member: Option.Option<string>;
    readonly yes: boolean;
  }) {
    const workspaceId = yield* resolveWorkspaceId();
    const [members, me, allowed] = yield* withSpinner("Loading members")(
      Effect.all(
        [
          Effect.map(listOrganizationMembers(workspaceId), (list) =>
            list.map(toMemberJson),
          ),
          getCurrentUser(),
          hasWorkspacePermission(workspaceId, { member: ["delete"] }),
        ],
        { concurrency: 3 },
      ),
    );
    const target = yield* chooseMember(members, options.member, {
      question: "Remove which member?",
      example: "kaneo member remove grace@example.com",
    });
    if (target.id === me.id) {
      return yield* new InvalidArgument({
        message: "You cannot remove yourself.",
        hint: "Run kaneo workspace leave <workspace> to leave it.",
      });
    }
    const mine = members.find((member) => member.id === me.id);
    if (
      hasRole(target.role, "owner") &&
      !(mine && hasRole(mine.role, "owner"))
    ) {
      return yield* new PermissionDenied({
        message: `Only an owner can remove ${target.name}, who is an owner.`,
        missingPermissions: [],
      });
    }
    if (!allowed) {
      return yield* new PermissionDenied({
        message: "You are not allowed to remove members from this workspace.",
        missingPermissions: ["member:delete"],
      });
    }

    yield* confirmDestructive({
      yes: options.yes,
      action: `Removing ${target.name}`,
      question: `Remove ${target.name} (${target.email}) from the workspace? They lose access to its projects and tasks.`,
    });

    yield* withSpinner(`Removing ${target.name}`)(
      removeOrganizationMember(workspaceId, target.memberId),
    ).pipe(
      Effect.catchTag("InvalidRequest", (error) =>
        Effect.fail(
          /only owner/i.test(error.message)
            ? new InvalidArgument({
                message: `${target.name} is the only owner, so they cannot be removed.`,
                hint: `Make another member an owner first with kaneo member role <member> owner.`,
              })
            : error,
        ),
      ),
    );

    yield* emit({ ...target, removed: true }, renderMemberRemoved);
  },
);

export const memberRemove = Command.make(
  "remove",
  {
    member: Argument.String("member").pipe(
      Argument.withDescription(
        "Email address, name or id; asked for when omitted in a terminal",
      ),
      Argument.optional,
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Remove without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runMemberRemove(options),
).pipe(
  Command.withDescription("Remove someone from the workspace"),
  Command.provide(ApiLayer),
);
