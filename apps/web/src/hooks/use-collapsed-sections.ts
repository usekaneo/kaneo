import { useCallback } from "react";
import { useStoredState } from "./use-stored-state";

const NONE_COLLAPSED: string[] = [];

function normalizeCollapsed(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : NONE_COLLAPSED;
}

// Stores collapsed ids rather than expanded ones so sections the user has
// never touched, such as a newly added column, start expanded.
export function useCollapsedSections(
  projectId: string | undefined,
  scope: "list" | "backlog",
) {
  const [collapsed, setCollapsed] = useStoredState(
    projectId ? `kaneo:${scope}-collapsed:${projectId}` : null,
    normalizeCollapsed,
    NONE_COLLAPSED,
  );

  const isExpanded = useCallback(
    (sectionId: string) => !collapsed.includes(sectionId),
    [collapsed],
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      setCollapsed((prev) =>
        prev.includes(sectionId)
          ? prev.filter((id) => id !== sectionId)
          : [...prev, sectionId],
      );
    },
    [setCollapsed],
  );

  const toggleAllSections = useCallback(
    (sectionIds: string[]) => {
      setCollapsed((prev) =>
        sectionIds.every((id) => prev.includes(id))
          ? NONE_COLLAPSED
          : sectionIds,
      );
    },
    [setCollapsed],
  );

  return { isExpanded, toggleSection, toggleAllSections };
}
