import type { PluginInfo, WebPluginDefinition } from "@kaneo/plugin-sdk/web";
import { type PluginLoadState, pluginLoadKey } from "@/store/plugin-runtime";
import type { InstalledPlugin, PluginWebAssets } from "@/types/plugin";
import type {
  ContributionItem,
  ContributionKind,
} from "./normalize-web-definition";

export type ActivePlugin = InstalledPlugin & { web: PluginWebAssets };

export type RuntimePlugin = {
  plugin: ActivePlugin;
  scope: PluginInfo;
  state: PluginLoadState;
};

export type Contribution<K extends ContributionKind> = {
  scope: PluginInfo;
  definition: WebPluginDefinition;
  item: ContributionItem<K>;
};

export type ContributionLookup<K extends ContributionKind> =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "failed"; error: Error }
  | { status: "ready"; contribution: Contribution<K> };

export function isActivePlugin(
  plugin: InstalledPlugin,
): plugin is ActivePlugin {
  return plugin.web !== null && plugin.workspace?.enabled === true;
}

export function toRuntimePlugins(
  plugins: readonly InstalledPlugin[],
  workspaceId: string,
  states: Readonly<Record<string, PluginLoadState>>,
): RuntimePlugin[] {
  return plugins.filter(isActivePlugin).map((plugin) => ({
    plugin,
    scope: {
      id: plugin.id,
      version: plugin.version,
      workspaceId,
      settings: plugin.workspace?.settings ?? {},
    },
    state: states[pluginLoadKey(plugin.id, plugin.version)] ?? {
      status: "loading",
    },
  }));
}

function itemsOf<K extends ContributionKind>(
  definition: WebPluginDefinition,
  kind: K,
): ContributionItem<K>[] {
  return (definition[kind] ?? []) as ContributionItem<K>[];
}

export function selectContributions<K extends ContributionKind>(
  plugins: readonly RuntimePlugin[],
  kind: K,
): Contribution<K>[] {
  return plugins.flatMap(({ scope, state }) =>
    state.status === "loaded"
      ? itemsOf(state.definition, kind).map((item) => ({
          scope,
          definition: state.definition,
          item,
        }))
      : [],
  );
}

export function findContribution<K extends ContributionKind>(
  plugins: readonly RuntimePlugin[],
  kind: K,
  pluginId: string,
  itemId: string,
  isPending: boolean,
): ContributionLookup<K> {
  const runtime = plugins.find((candidate) => candidate.plugin.id === pluginId);
  if (!runtime) return { status: isPending ? "loading" : "missing" };
  const { state, scope } = runtime;
  if (state.status === "loading") return { status: "loading" };
  if (state.status === "failed")
    return { status: "failed", error: state.error };
  const item = itemsOf(state.definition, kind).find(
    (candidate) => candidate.id === itemId,
  );
  return item
    ? {
        status: "ready",
        contribution: { scope, definition: state.definition, item },
      }
    : { status: "missing" };
}
