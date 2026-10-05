import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
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
      columnId: "review-column",
      projectId: "project",
      workspaceId: "workspace",
    },
  });
  queries.activity.mockReturnValue({ data: [] });
});
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    params,
    children,
    ...props
  }: {
    params: { workspaceId: string; projectId: string; taskId: string };
    children?: ReactNode;
  }) => (
    <a
      {...props}
      href={`/dashboard/workspace/${params.workspaceId}/project/${params.projectId}/task/${params.taskId}`}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({ default: queries.task }));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: [
      {
        id: "other-column",
        slug: "review",
        name: "Other queue",
        icon: "Circle",
        isFinal: true,
      },
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
  it("updates the task link when a remote move changes its project and workspace", () => {
    const view = render(
      <InboxTask taskId="task" workspaceId="old-workspace" />,
    );
    expect(
      screen.getByRole("link", { name: "notifications:inbox.openTask" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/workspace/workspace/project/project/task/task",
    );
    queries.task.mockReturnValue({
      data: {
        id: "task",
        title: "Moved task",
        status: "review",
        projectId: "new-project",
        workspaceId: "new-workspace",
      },
    });
    view.rerender(<InboxTask taskId="task" workspaceId="old-workspace" />);
    expect(
      screen.getByRole("link", { name: "notifications:inbox.openTask" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/workspace/new-workspace/project/new-project/task/task",
    );
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
    const refetch = vi.fn();
    queries.task.mockReturnValue({
      isError: true,
      error: new Error("Network unavailable"),
      refetch,
    });
    render(<InboxTask taskId="task" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "notifications:inbox.taskLoadError",
    );
    fireEvent.click(screen.getByText("common:error.tryAgain"));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it("reports an inaccessible or deleted task without a misleading network retry", () => {
    queries.task.mockReturnValue({
      isError: true,
      error: new HttpError(404, "Not found"),
    });
    render(<InboxTask taskId="task" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "notifications:inbox.taskUnavailable",
    );
    expect(screen.queryByText("common:error.tryAgain")).not.toBeInTheDocument();
  });
});
