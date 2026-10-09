import type { WorkspaceMember } from "../api/schemas.js";

export function matchMember(
  members: ReadonlyArray<WorkspaceMember>,
  reference: string,
): WorkspaceMember | undefined {
  const wanted = reference.trim().toLowerCase();
  return (
    members.find((member) => member.id === reference.trim()) ??
    members.find((member) => member.email.toLowerCase() === wanted) ??
    members.find((member) => member.name.toLowerCase() === wanted)
  );
}
