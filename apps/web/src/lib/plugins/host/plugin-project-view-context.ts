import type { ProjectViewState } from "@kaneo/plugin-sdk/web";
import { createContext, useContext } from "react";

export const PluginProjectViewContext = createContext<ProjectViewState | null>(
  null,
);

export function usePluginProjectView(): ProjectViewState {
  const state = useContext(PluginProjectViewContext);
  if (!state) {
    throw new Error(
      "useProjectView only works inside a plugin's project view or its display controls",
    );
  }
  return state;
}
