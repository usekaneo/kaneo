import { Effect } from "effect";
import { Command } from "effect/cli";
import { sortMembers, toMemberJson } from "../../admin/member-json.js";
import { renderMemberList } from "../../admin/render-member-list.js";
import { listOrganizationMembers } from "../../api/members.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveWorkspaceId } from "../../services/selection.js";
import { ApiLayer } from "../api-layer.js";

export const runMemberList = Effect.fn("command.member.list")(function* () {
  const workspaceId = yield* resolveWorkspaceId();
  const members = yield* withSpinner("Loading members")(
    listOrganizationMembers(workspaceId),
  );
  yield* emit(sortMembers(members.map(toMemberJson)), (ui, value) =>
    renderMemberList(ui, { members: value, now: new Date() }),
  );
});

export const memberList = Command.make("list", {}, () => runMemberList()).pipe(
  Command.withDescription("List the members of a workspace with their roles"),
  Command.provide(ApiLayer),
);
