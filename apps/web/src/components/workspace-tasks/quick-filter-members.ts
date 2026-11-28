export type QuickFilterMember = {
  userId: string;
  user?: { image?: string | null; name?: string | null } | null;
};

// Beyond this the row stops being a glance; the rest sits behind "+N".
export const QUICK_FILTER_LIMIT = 8;

/**
 * Order members for the quick filter (the viewer first, then by name) and
 * split them into the visible row and the overflow. A selected person is
 * always visible, so a choice made in the popover never disappears.
 */
export function arrangeQuickFilterMembers(
  members: QuickFilterMember[],
  selected: string[],
  currentUserId?: string,
  limit = QUICK_FILTER_LIMIT,
) {
  const ordered = [...members].sort((left, right) => {
    if (left.userId === currentUserId) return -1;
    if (right.userId === currentUserId) return 1;
    return (left.user?.name ?? "").localeCompare(right.user?.name ?? "");
  });
  const visible: QuickFilterMember[] = [];
  const overflow: QuickFilterMember[] = [];
  for (const [index, member] of ordered.entries()) {
    if (index < limit || selected.includes(member.userId)) visible.push(member);
    else overflow.push(member);
  }
  return { visible, overflow };
}
