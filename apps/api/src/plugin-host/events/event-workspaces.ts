import type { MappedPluginEvent } from "./map-internal-event";

export type EventWorkspaces = {
  workspaceId: string;
  enabledIn: string[];
};

export function explicitWorkspaces(
  event: MappedPluginEvent,
): EventWorkspaces | null {
  if (event.type !== "project.moved") return null;
  return {
    workspaceId: event.toWorkspaceId,
    enabledIn: [...new Set([event.fromWorkspaceId, event.toWorkspaceId])],
  };
}
