import { afterEach, describe, expect, expectTypeOf, it } from "vite-plus/test";
import { PLUGIN_HOST_GLOBAL } from "../shared-modules.js";
import { defineWeb } from "./define-web.js";
import { useProjectView } from "./hooks.js";
import type {
  PluginTask,
  ProjectView,
  ProjectViewProps,
  ProjectViewScope,
  ProjectViewState,
} from "./types.js";

const task: PluginTask = {
  id: "task-1",
  projectId: "project-1",
  number: 1,
  title: "Plan launch",
  description: null,
  status: "to-do",
  priority: null,
  assigneeId: null,
  assigneeName: null,
  startDate: "2026-10-01T00:00:00.000Z",
  dueDate: null,
};

const host = globalThis as Record<string, unknown>;

afterEach(() => {
  delete host[PLUGIN_HOST_GLOBAL];
});

describe("useProjectView", () => {
  it("returns the layout's tasks from Kaneo's host", () => {
    const state: ProjectViewState = {
      tasks: [task],
      allTasks: [task, { ...task, id: "task-2" }],
      isLoading: false,
      error: null,
    };
    host[PLUGIN_HOST_GLOBAL] = { useProjectView: () => state };

    expect(useProjectView()).toBe(state);
  });

  it("explains that it only works inside Kaneo", () => {
    expect(() => useProjectView()).toThrow(
      "@kaneo/plugin-sdk/web only works inside Kaneo's web app",
    );
  });
});

describe("project view types", () => {
  it("accepts a schedule layout with display controls and a task count rule", () => {
    const Timeline = (_props: ProjectViewProps) => null;
    const definition = defineWeb({
      projectViews: [
        {
          id: "timeline",
          title: "Timeline",
          scope: "schedule",
          display: Timeline,
          countsTask: (item) => item.dueDate !== null,
          component: Timeline,
        },
      ],
    });

    expect(definition.projectViews?.[0]?.scope).toBe("schedule");
    expectTypeOf<ProjectView["scope"]>().toEqualTypeOf<
      ProjectViewScope | undefined
    >();
    expectTypeOf<ProjectViewScope>().toEqualTypeOf<"board" | "schedule">();
    expectTypeOf<ProjectViewState["tasks"]>().toEqualTypeOf<PluginTask[]>();
    expectTypeOf<NonNullable<ProjectView["countsTask"]>>().toEqualTypeOf<
      (task: PluginTask) => boolean
    >();
  });
});
