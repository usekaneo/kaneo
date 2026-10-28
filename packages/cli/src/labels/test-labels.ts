import type { Label } from "../api/labels.js";

export function workspaceLabel(
  id: string,
  name: string,
  overrides: Partial<Label> = {},
): Label {
  return {
    id,
    name,
    color: "gray",
    taskId: null,
    workspaceId: "ws_1",
    deletionStartedAt: null,
    ...overrides,
  };
}

export function taskLabel(id: string, name: string, taskId: string): Label {
  return workspaceLabel(id, name, { taskId });
}
