import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";
import { UpNext } from "./up-next";

const { getAssignedTasks } = vi.hoisted(() => ({ getAssignedTasks: vi.fn() }));
vi.mock("@/fetchers/task/get-assigned-tasks", () => ({
  default: getAssignedTasks,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: PropsWithChildren) => <a href="/my-tasks">{children}</a>,
}));
vi.mock("@/components/my-work/assigned-task-row", () => ({
  AssignedTaskRow: ({ task }: { task: { title: string } }) => (
    <span>{task.title}</span>
  ),
}));

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});

function Harness() {
  const query = useGetAssignedTasks("workspace");
  return (
    <UpNext
      tasks={query.data?.tasks}
      total={query.data?.total ?? 0}
      isLoading={query.isLoading}
      isError={query.isError}
      workspaceId="workspace"
    />
  );
}

function mount() {
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

it("keeps loaded tasks visible after a transient background refresh failure", async () => {
  getAssignedTasks.mockResolvedValue({
    tasks: [{ id: "task", title: "Still here" }],
    total: 1,
  });
  mount();
  expect(await screen.findByText("Still here")).toBeVisible();
  getAssignedTasks.mockRejectedValue(new Error("Network unavailable"));
  await act(async () => {
    await client.refetchQueries({ queryKey: ["assigned-tasks", "workspace"] });
  });
  expect(screen.getByText("Still here")).toBeVisible();
  expect(
    screen.queryByText("workspace:myWork.loadError"),
  ).not.toBeInTheDocument();
});

it("shows the load error when no tasks have been loaded", async () => {
  getAssignedTasks.mockRejectedValue(new Error("Network unavailable"));
  mount();
  expect(await screen.findByText("workspace:myWork.loadError")).toBeVisible();
});
