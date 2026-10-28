export const NONE_COLLAPSED: string[] = [];

export function collapsedSectionsKey(
  projectId: string,
  scope: "list" | "backlog",
) {
  return `kaneo:${scope}-collapsed:${projectId}`;
}

export function normalizeCollapsed(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : NONE_COLLAPSED;
}

// List sections are keyed by column slug, which a new column can reuse after
// the old one was deleted or renamed. Forget it so the new column starts
// expanded instead of inheriting the old column's state.
export function forgetCollapsedColumn(projectId: string, slug: string) {
  const key = collapsedSectionsKey(projectId, "list");
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return;
    const collapsed = normalizeCollapsed(JSON.parse(raw));
    if (!collapsed.includes(slug)) return;
    window.localStorage.setItem(
      key,
      JSON.stringify(collapsed.filter((id) => id !== slug)),
    );
  } catch {}
}
