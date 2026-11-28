import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";
import {
  type ProjectRoute,
  type ProjectView,
  routeForView,
} from "./project-views";
import { viewLocation } from "./view-location";

export function useGoToProjectView({
  workspaceId,
  projectId,
  currentRoute,
}: {
  workspaceId: string;
  projectId: string;
  currentRoute: ProjectRoute;
}) {
  const navigate = useNavigate();
  const setViewMode = useUserPreferencesStore((state) => state.setViewMode);
  const setTaskLayout = useUserPreferencesStore((state) => state.setTaskLayout);

  return useCallback(
    (view: ProjectView) => {
      if (view === "board" || view === "list") setViewMode(view);
      if (view !== "backlog") setTaskLayout(view);
      const route = routeForView(view);
      if (route === currentRoute) return;
      navigate(viewLocation(route, workspaceId, projectId));
    },
    [
      currentRoute,
      navigate,
      projectId,
      setTaskLayout,
      setViewMode,
      workspaceId,
    ],
  );
}
