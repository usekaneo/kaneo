import type { ImportedPerson } from "../types.js";
import type { TrelloMember } from "./client.js";

export function trelloPerson(
  member: Partial<TrelloMember> | null | undefined,
  owner: TrelloMember,
): ImportedPerson | undefined {
  if (!member) return undefined;
  const name = member.fullName?.trim() || member.username?.trim();
  const email =
    member.id && member.id === owner.id ? owner.email?.trim() : undefined;
  if (!name && !email) return undefined;
  return { ...(name ? { name } : {}), ...(email ? { email } : {}) };
}
