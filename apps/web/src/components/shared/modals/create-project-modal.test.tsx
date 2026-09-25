import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CreateProjectModal from "./create-project-modal";

const navigate = vi.fn(async () => {});
const createProject = vi.fn(async () => ({ id: "new-project" }));
const deleteProject = vi.fn(async () => ({}));
const templates = [
  { id: "saved-template", name: "Saved workflow", icon: "Layout" },
];

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));
vi.mock("@/hooks/mutations/project/use-create-project", () => ({
  default: () => ({ mutateAsync: createProject, isPending: false }),
}));
vi.mock("@/hooks/mutations/project/use-delete-project", () => ({
  default: () => ({ mutateAsync: deleteProject, isPending: false }),
}));
vi.mock("@/hooks/queries/project/use-get-project-templates", () => ({
  default: () => ({ data: templates, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace", name: "Workspace" } }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canDeleteProjects: () => true }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return {
    useTranslation: () => ({ t }),
    initReactI18next: { type: "3rdParty", init: vi.fn() },
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderModal(props: Parameters<typeof CreateProjectModal>[0]) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateProjectModal {...props} />
    </QueryClientProvider>,
  );
}

it("duplicates a project without tasks by default and navigates to the new board", async () => {
  renderModal({
    open: true,
    onClose: vi.fn(),
    mode: "duplicate",
    sourceProject: { id: "source", name: "Roadmap", icon: "Layout" },
  });

  expect(screen.getByRole("checkbox")).not.toBeChecked();
  fireEvent.click(
    screen.getByRole("button", {
      name: "common:modals.createProject.duplicateButton",
    }),
  );

  await waitFor(() => {
    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceProjectId: "source",
        includeTasks: false,
        workspaceId: "workspace",
      }),
    );
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { workspaceId: "workspace", projectId: "new-project" },
      }),
    );
  });
});

it("saves a template with tasks without navigating to a board", async () => {
  const onClose = vi.fn();
  renderModal({
    open: true,
    onClose,
    mode: "template",
    sourceProject: { id: "source", name: "Roadmap", icon: "Layout" },
  });

  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", {
      name: "common:modals.createProject.templateButton",
    }),
  );

  await waitFor(() => {
    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceProjectId: "source",
        includeTasks: true,
        asTemplate: true,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
  expect(navigate).not.toHaveBeenCalled();
});
