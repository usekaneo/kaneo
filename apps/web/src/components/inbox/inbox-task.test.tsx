import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { InboxTask } from "./inbox-task";

const queries = vi.hoisted(() => ({
  activity: vi.fn(),
  task: vi.fn(),
}));
beforeEach(() => {
  queries.task.mockReturnValue({
    data: {
      id: "task",
      title: "Custom workflow",
      status: "review",
      projectId: "project",
    },
  });
  queries.activity.mockReturnValue({ data: [] });
});
vi.mock("@/hooks/queries/task/use-get-task", () => ({ default: queries.task }));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: [
      {
        id: "review-column",
        slug: "review",
        name: "Awaiting approval",
        icon: "Flag",
        isFinal: false,
      },
    ],
  }),
}));
vi.mock("@/hooks/queries/activity/use-get-activities-by-task-id", () => ({
  default: queries.activity,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => false }),
}));
vi.mock("@/components/activity", () => ({ default: () => null }));
vi.mock("@/components/activity/comment-input", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(cleanup);
describe("Inbox task preview", () => {
  it("uses the configured column name and icon and requests six activities", () => {
    render(<InboxTask taskId="task" />);
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
    expect(document.querySelector(".lucide-flag")).not.toBeNull();
    expect(queries.activity).toHaveBeenCalledWith("task", true, 6);
  });
  it("keeps cached task and activity content after a failed background refresh", () => {
    queries.task.mockReturnValue({
      data: { title: "Cached task", status: "review", projectId: "project" },
      isError: true,
    });
    queries.activity.mockReturnValue({ data: [], isError: true });
    render(<InboxTask taskId="task" />);
    expect(screen.getByText("Cached task")).toBeVisible();
    expect(
      screen.queryByText("notifications:inbox.taskUnavailable"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("workspace:home.activity.loadError"),
    ).not.toBeInTheDocument();
  });

  it("announces initial task failures", () => {
    queries.task.mockReturnValue({ isError: true });
    render(<InboxTask taskId="task" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "notifications:inbox.taskUnavailable",
    );
  });
});
