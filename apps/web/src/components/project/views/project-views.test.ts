import { expect, it } from "vite-plus/test";
import {
  resolveProjectView,
  routeForView,
  tasksViewFor,
} from "./project-views";
import { viewLocation } from "./view-location";

it("serves board and list from the board route", () => {
  expect(routeForView("list")).toBe("board");
  expect(routeForView("calendar")).toBe("calendar");
  expect(resolveProjectView("board", "list")).toBe("list");
  expect(resolveProjectView("calendar", "list")).toBe("calendar");
});

it("serves a plugin layout from its own route", () => {
  expect(routeForView("plugin:gantt:timeline")).toBe("plugin:gantt:timeline");
  expect(resolveProjectView("plugin:gantt:timeline", "list")).toBe(
    "plugin:gantt:timeline",
  );
  expect(viewLocation("plugin:gantt:timeline", "w", "p")).toEqual({
    to: "/dashboard/workspace/$workspaceId/project/$projectId/plugin/$pluginId/$viewId",
    params: {
      workspaceId: "w",
      projectId: "p",
      pluginId: "gantt",
      viewId: "timeline",
    },
  });
  expect(viewLocation("backlog", "w", "p")).toEqual({
    to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
    params: { workspaceId: "w", projectId: "p" },
  });
});

it("returns to the last task layout, falling back to board or list", () => {
  expect(tasksViewFor("calendar", "list", [])).toBe("calendar");
  expect(tasksViewFor("list", "board", [])).toBe("board");
  expect(tasksViewFor("board", "list", [])).toBe("list");
});

it("returns to a remembered plugin layout only while the plugin offers it", () => {
  const gantt = "plugin:gantt:timeline" as const;
  expect(tasksViewFor(gantt, "board", [gantt])).toBe(gantt);
  expect(tasksViewFor(gantt, "board", [])).toBe("board");
  expect(tasksViewFor(gantt, "list", ["plugin:other:chart"])).toBe("list");
});
