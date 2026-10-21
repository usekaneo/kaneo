import { i18n } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { PersonalViews } from "./personal-views";
import type { PersonalView, ProjectViewConfig } from "@/fetchers/saved-view";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/fetchers/saved-view", () => ({
  getPersonalViews: api.list,
  savePersonalView: api.save,
  deletePersonalView: api.remove,
}));
const config: ProjectViewConfig = {
  version: 1,
  search: "bug",
  filters: {
    status: null,
    priority: ["high"],
    assignee: null,
    dueDate: null,
    createdDate: null,
    labels: null,
    customFields: null,
    negated: null,
  },
  sort: { field: "priority", direction: "desc" },
  layout: "list",
};
let views: PersonalView[];
beforeEach(async () => {
  await i18n.changeLanguage("en-US");
  views = [];
  api.list.mockImplementation(async () => views);
  api.save.mockImplementation(
    async (
      projectId: string,
      name: string,
      config: ProjectViewConfig,
      id?: string,
    ) => {
      const view = { id: id ?? "view-1", projectId, name, config };
      views = [...views.filter((view) => view.id !== id), view];
      return view;
    },
  );
  api.remove.mockImplementation(async (_projectId: string, id: string) => {
    views = views.filter((view) => view.id !== id);
    return { success: true };
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function mount(current = config) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const apply = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <PersonalViews projectId="project-1" config={current} onApply={apply} />
    </QueryClientProvider>,
  );
  return apply;
}
it("saves, restores, renames without overwriting filters, and confirms deletion", async () => {
  const apply = mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Personal views" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Save current view" }),
  );
  let dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("View name"), {
    target: { value: "My bugs" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Save current view" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.save).toHaveBeenCalledWith(
    "project-1",
    "My bugs",
    config,
    undefined,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Personal views" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "My bugs" }));
  expect(apply).toHaveBeenCalledWith(config);
  fireEvent.click(
    await screen.findByRole("button", { name: "Personal views" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Edit My bugs" }));
  dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("View name"), {
    target: { value: "Renamed" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.save).toHaveBeenLastCalledWith(
    "project-1",
    "Renamed",
    config,
    "view-1",
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Personal views" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Edit Renamed" }));
  dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
  expect(api.remove).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Confirm delete" }),
  );
  await waitFor(() =>
    expect(api.remove).toHaveBeenCalledWith("project-1", "view-1"),
  );
});
it("shows a retryable loading failure without inventing an empty view list", async () => {
  api.list.mockRejectedValue(new Error("offline"));
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Personal views" }),
  );
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Could not load");
  api.list.mockResolvedValue([]);
  fireEvent.click(within(alert).getByRole("button"));
  expect(await screen.findByText("No saved views yet.")).toBeDefined();
});
