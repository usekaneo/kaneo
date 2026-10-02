import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { InboxTask } from "./inbox-task";

const activityQuery = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({
    data: {
      id: "task",
      title: "Custom workflow",
      status: "review",
      columnId: "review-column",
      projectId: "project",
    },
  }),
}));
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
  default: activityQuery,
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
    expect(activityQuery).toHaveBeenCalledWith("task", true, 6);
  });
});
