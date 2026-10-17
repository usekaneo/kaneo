import { useCallback } from "react";
import {
  collapsedSectionsKey,
  NONE_COLLAPSED,
  normalizeCollapsed,
} from "@/lib/collapsed-sections";
import { useStoredState } from "./use-stored-state";

// Stores collapsed ids rather than expanded ones so sections the user has
// never touched, such as a newly added column, start expanded.
export function useCollapsedSections(
  projectId: string | undefined,
  scope: "list" | "backlog",
) {
  const [collapsed, setCollapsed] = useStoredState(
    projectId ? collapsedSectionsKey(projectId, scope) : null,
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
