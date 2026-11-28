import { type ReactNode, useEffect, useMemo } from "react";
import { useGetPlugins } from "@/hooks/queries/plugin/use-get-plugins";
import { loadPlugin } from "@/lib/plugins/runtime/load-plugin";
import {
  PluginsContext,
  type PluginsContextValue,
} from "@/lib/plugins/runtime/plugins-context";
import {
  isActivePlugin,
  toRuntimePlugins,
} from "@/lib/plugins/runtime/select-contributions";
import { usePluginRuntimeStore } from "@/store/plugin-runtime";

type PluginsProviderProps = {
  workspaceId: string | undefined;
  children: ReactNode;
};

export function PluginsProvider({
  workspaceId,
  children,
}: PluginsProviderProps) {
  const { data, isPending } = useGetPlugins(workspaceId);
  const states = usePluginRuntimeStore((store) => store.states);
  const installed = data?.plugins;

  useEffect(() => {
    for (const plugin of installed ?? []) {
      if (isActivePlugin(plugin)) void loadPlugin(plugin);
    }
  }, [installed]);

  const value = useMemo<PluginsContextValue>(
    () => ({
      workspaceId,
      plugins:
        workspaceId && installed
          ? toRuntimePlugins(installed, workspaceId, states)
          : [],
      isPending: Boolean(workspaceId) && isPending,
    }),
    [workspaceId, installed, states, isPending],
  );

  return (
    <PluginsContext.Provider value={value}>{children}</PluginsContext.Provider>
  );
}
