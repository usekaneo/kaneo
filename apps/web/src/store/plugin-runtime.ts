import type { WebPluginDefinition } from "@kaneo/plugin-sdk/web";
import { create } from "zustand";

export type PluginLoadState =
  | { status: "loading" }
  | { status: "loaded"; definition: WebPluginDefinition }
  | { status: "failed"; error: Error };

type PluginRuntimeStore = {
  states: Record<string, PluginLoadState>;
  setState: (key: string, state: PluginLoadState) => void;
};

export function pluginLoadKey(pluginId: string, version: string): string {
  return `${pluginId}@${version}`;
}

export const usePluginRuntimeStore = create<PluginRuntimeStore>((set) => ({
  states: {},
  setState: (key, state) =>
    set((current) => ({ states: { ...current.states, [key]: state } })),
}));
