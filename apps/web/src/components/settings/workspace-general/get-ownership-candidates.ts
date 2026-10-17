type OwnershipMember = {
  id: string;
  role: string;
  userId: string;
};

export function getOwnershipCandidates<T extends OwnershipMember>(
  members: T[],
  currentUserId: string | undefined,
) {
  return {
    currentOwner: members.find((member) => member.role === "owner"),
    eligibleNewOwners: members.filter(
      (member) => member.role !== "owner" && member.userId !== currentUserId,
    ),
  };
}
