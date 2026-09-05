import { useMemo } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";
import { useUserPreferencesStore } from "@/store/user-preferences";

export type UseProjectBackground = {
  backgroundVersion?: string | null;
  projectId?: string;
  viewMode?: "list" | "board";
};

export function useProjectBackground({
  backgroundVersion,
  viewMode,
  projectId,
}: UseProjectBackground): string | null {
  const { showProjectBackgrounds } = useUserPreferencesStore();
  const shouldShowBackground =
    showProjectBackgrounds &&
    backgroundVersion &&
    viewMode === "board" &&
    projectId;

  const backgroundUrl = useMemo(() => {
    if (!shouldShowBackground) return null;
    return getApiUrl(
      `project/${projectId}/background?v=${encodeURIComponent(backgroundVersion)}`,
    );
  }, [shouldShowBackground, backgroundVersion, projectId]);

  return backgroundUrl;
}
