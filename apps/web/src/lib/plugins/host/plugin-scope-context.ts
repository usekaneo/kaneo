import type { PluginInfo } from "@kaneo/plugin-sdk/web";
import { createContext, useContext } from "react";

export const PluginScopeContext = createContext<PluginInfo | null>(null);

export function usePluginScope(): PluginInfo {
  const scope = useContext(PluginScopeContext);
  if (!scope) {
    throw new Error(
      "Kaneo plugin hooks only work inside a component that Kaneo renders for a plugin",
    );
  }
  return scope;
}
