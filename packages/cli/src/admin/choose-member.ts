import { Effect, Option } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { pick } from "../prompts/pick.js";
import { matchOrgMember } from "./match-org-member.js";
import type { MemberJson } from "./member-json.js";
import { roleLabel } from "./roles.js";

export const chooseMember = Effect.fnUntraced(function* (
  members: ReadonlyArray<MemberJson>,
  reference: Option.Option<string>,
  options: { readonly question: string; readonly example: string },
) {
  const output = yield* Output;
  if (Option.isSome(reference)) {
    const match = matchOrgMember(members, reference.value);
    if (match) return match;
    return yield* new InvalidArgument({
      message: `No workspace member matches "${reference.value}".`,
      hint: "Use an email address, a name, or an id. Run kaneo member list to see them.",
    });
  }
  if (output.interactive && members.length > 0) {
    return yield* pick(
      options.question,
      members.map((member) => ({
        title: member.name,
        value: member,
        description: `${member.email}, ${roleLabel(member.role)}`,
      })),
    );
  }
  return yield* new InvalidArgument({
    message: "Which member?",
    hint: `Pass an email address, a name, or an id, for example ${options.example}.`,
  });
});
