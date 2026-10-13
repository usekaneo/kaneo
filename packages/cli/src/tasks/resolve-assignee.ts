import { Effect } from "effect";
import { getCurrentUser, listMembers } from "../api/endpoints.js";
import { InvalidArgument } from "../errors/errors.js";
import { matchMember } from "./match-member.js";

export type Assignee = { readonly id: string; readonly name: string };

export const resolveAssignee = Effect.fn("tasks.resolveAssignee")(function* (
  workspaceId: string,
  reference: string,
) {
  if (reference.trim().toLowerCase() === "me") {
    const user = yield* getCurrentUser();
    return { id: user.id, name: user.name } satisfies Assignee;
  }
  const members = yield* listMembers(workspaceId);
  const member = matchMember(members, reference);
  if (!member) {
    return yield* new InvalidArgument({
      message: `No workspace member matches "${reference}".`,
      hint: 'Use "me", an email address, a name, or a user id.',
    });
  }
  return { id: member.id, name: member.name } satisfies Assignee;
});
