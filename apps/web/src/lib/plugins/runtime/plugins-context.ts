import { createContext, useContext } from "react";
import type { RuntimePlugin } from "./select-contributions";

export type PluginsContextValue = {
  workspaceId: string | undefined;
  plugins: RuntimePlugin[];
  isPending: boolean;
};

export const PluginsContext = createContext<PluginsContextValue>({
  workspaceId: undefined,
  plugins: [],
  isPending: false,
});

export function usePlugins(): PluginsContextValue {
  return useContext(PluginsContext);
}
