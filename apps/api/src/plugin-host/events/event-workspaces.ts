import type { MappedPluginEvent } from "./map-internal-event";

export type EventWorkspaces = {
  workspaceId: string;
  enabledIn: string[];
};

export function eventWorkspaces(
  event: MappedPluginEvent,
  data?: unknown,
): EventWorkspaces | null {
  if (event.type !== "project.moved") {
    // The project can move before the asynchronous bridge gets the event.
    const workspaceId = (data as { workspaceId?: unknown } | null | undefined)
      ?.workspaceId;
    return typeof workspaceId === "string" && workspaceId
      ? { workspaceId, enabledIn: [workspaceId] }
      : null;
  }
  return {
    workspaceId: event.toWorkspaceId,
    enabledIn: [...new Set([event.fromWorkspaceId, event.toWorkspaceId])],
  };
}
