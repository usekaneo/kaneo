import { describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./gantt";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => ({ redirect: options }),
}));

type RedirectRoute = {
  validateSearch: (search: Record<string, unknown>) => { taskId?: string };
  beforeLoad: (context: {
    params: { workspaceId: string; projectId: string };
    search: { taskId?: string };
  }) => void;
};

const route = Route as unknown as RedirectRoute;
const params = { workspaceId: "w1", projectId: "p1" };

function redirectFor(search: { taskId?: string }) {
  try {
    route.beforeLoad({ params, search });
  } catch (thrown) {
    return thrown;
  }
  return null;
}

describe("legacy Gantt route", () => {
  it("sends bookmarks to the Gantt plugin view", () => {
    expect(redirectFor({})).toEqual({
      redirect: {
        to: "/dashboard/workspace/$workspaceId/project/$projectId/plugin/$pluginId/$viewId",
        params: { ...params, pluginId: "gantt", viewId: "timeline" },
        search: {},
        replace: true,
      },
    });
  });

  it("keeps an open task", () => {
    expect(route.validateSearch({ taskId: "t1", extra: 1 })).toEqual({
      taskId: "t1",
    });
    expect(redirectFor({ taskId: "t1" })).toMatchObject({
      redirect: { search: { taskId: "t1" } },
    });
  });
});
