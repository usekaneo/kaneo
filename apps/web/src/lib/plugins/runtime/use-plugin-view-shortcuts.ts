import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  type PluginViewShortcut,
  selectViewShortcuts,
} from "./select-view-shortcuts";
import { useProjectPluginViews } from "./use-project-plugin-views";

const BUILT_IN_VIEW_KEYS = [
  shortcuts.view.board,
  shortcuts.view.list,
  shortcuts.view.calendar,
  shortcuts.view.backlog,
];

export function usePluginViewShortcuts(
  workspaceId: string,
  projectId: string,
): void {
  const navigate = useNavigate();
  const views = useProjectPluginViews(workspaceId, projectId);
  const signature = JSON.stringify(
    selectViewShortcuts(views, BUILT_IN_VIEW_KEYS),
  );

  const config = useMemo(() => {
    const selected = JSON.parse(signature) as PluginViewShortcut[];
    return {
      sequentialShortcuts: {
        [shortcuts.view.prefix]: Object.fromEntries(
          selected.map(({ key, pluginId, viewId }) => [
            key,
            () =>
              navigate({
                to: "/dashboard/workspace/$workspaceId/project/$projectId/plugin/$pluginId/$viewId",
                params: { workspaceId, projectId, pluginId, viewId },
              }),
          ]),
        ),
      },
    };
  }, [navigate, projectId, signature, workspaceId]);

  useRegisterShortcuts(config);
}
