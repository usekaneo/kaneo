import { matchMember } from "../tasks/match-member.js";
import type { MemberJson } from "./member-json.js";

function only<A>(matches: ReadonlyArray<A>): A | undefined {
  return matches.length === 1 ? matches[0] : undefined;
}

export function matchOrgMember(
  members: ReadonlyArray<MemberJson>,
  reference: string,
): MemberJson | undefined {
  const trimmed = reference.trim();
  const wanted = trimmed.toLowerCase();
  if (wanted === "") return undefined;
  const byMemberId = members.find((member) => member.memberId === trimmed);
  if (byMemberId) return byMemberId;
  const match = matchMember(members, reference);
  if (match) return members.find((member) => member.id === match.id);
  return (
    only(
      members.filter(
        (member) => member.email.toLowerCase().split("@")[0] === wanted,
      ),
    ) ??
    only(
      members.filter((member) => member.name.toLowerCase().startsWith(wanted)),
    )
  );
}
