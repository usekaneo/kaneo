import { describe, expect, it } from "vite-plus/test";
import { routeHostsTaskSheet } from "./route-hosts-task-sheet";

const project =
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId";

describe("routeHostsTaskSheet", () => {
  it.each(["board", "backlog", "calendar", "plugin/$pluginId/$viewId"])(
    "opens tasks in the sheet on the %s view",
    (view) => {
      expect(routeHostsTaskSheet(`${project}/${view}`)).toBe(true);
    },
  );

  it.each([
    `${project}/task/$taskId_`,
    `${project}/gantt`,
    "/_layout/_authenticated/dashboard/workspace/$workspaceId/plugin/$pluginId/$pageId",
    "/_layout/_authenticated/dashboard/settings/workspace/plugins",
    undefined,
  ])("navigates to the task page from %s", (routeId) => {
    expect(routeHostsTaskSheet(routeId)).toBe(false);
  });
});
