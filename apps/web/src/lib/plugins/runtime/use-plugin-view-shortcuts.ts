import { useEffect, useLayoutEffect, useRef } from "react";
import { parseBinding } from "@/lib/shortcuts/key-combo";
import { shortcutRegistry } from "@/lib/shortcuts/registry";
import { type PluginViewRef, pluginLayoutId } from "../plugin-layout-id";
import { PLUGIN_VIEW_PREFIX, takenViewKeys } from "./plugin-view-keys";
import {
  type PluginViewShortcut,
  selectViewShortcuts,
} from "./select-view-shortcuts";
import type { ProjectPluginView } from "./use-project-plugin-views";

const TAKEN_KEYS = takenViewKeys();

export function usePluginViewShortcuts(
  views: readonly ProjectPluginView[],
  goToView: (view: PluginViewRef) => void,
  enabled: boolean,
): void {
  const goToViewRef = useRef(goToView);
  useLayoutEffect(() => {
    goToViewRef.current = goToView;
  });

  const signature = JSON.stringify(selectViewShortcuts(views, TAKEN_KEYS));

  useEffect(() => {
    if (!enabled) return;
    const selected = JSON.parse(signature) as PluginViewShortcut[];
    const unregister = selected.map(({ key, title, pluginId, viewId }) => {
      const keys = `${PLUGIN_VIEW_PREFIX} ${key}`;
      return shortcutRegistry.register({
        id: pluginLayoutId({ pluginId, viewId }),
        bindings: [parseBinding(keys)],
        scope: "view",
        listing: { label: title, keys: [keys], category: "views" },
        handler: () => goToViewRef.current({ pluginId, viewId }),
      });
    });
    return () => {
      for (const release of unregister) release();
    };
  }, [enabled, signature]);
}
