import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { ProjectDangerZone } from "./project-danger-zone";

const m = vi.hoisted(() => ({
  deleteProject: vi.fn(),
  navigate: vi.fn(),
  invalidate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => m.navigate,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: m.invalidate }),
}));
vi.mock("@/hooks/mutations/project/use-delete-project", () => ({
  default: () => ({ mutateAsync: m.deleteProject, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.error },
}));

const project = { id: "p1", name: "Website" } as ProjectWithTasks;

describe("ProjectDangerZone", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    m.deleteProject.mockResolvedValue(undefined);
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  });

  it("asks before deleting and deletes on confirm", async () => {
    render(
      <ProjectDangerZone project={project} isCurrentProject workspaceId="w1" />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectGeneral.deleteProject",
      }),
    );
    expect(m.deleteProject).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "settings:projectGeneral.deleteModalConfirm",
      }),
    );

    await waitFor(() =>
      expect(m.deleteProject).toHaveBeenCalledWith({ id: "p1" }),
    );
    await waitFor(() =>
      expect(m.navigate).toHaveBeenCalledWith({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: "w1" },
      }),
    );
  });

  it("keeps the delete button disabled while the store holds another project", () => {
    render(
      <ProjectDangerZone
        project={project}
        isCurrentProject={false}
        workspaceId="w1"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "settings:projectGeneral.deleteProject",
      }),
    ).toBeDisabled();
  });

  it("shows the error and does not navigate when deleting fails", async () => {
    m.deleteProject.mockRejectedValue(new Error("Nope"));
    render(
      <ProjectDangerZone project={project} isCurrentProject workspaceId="w1" />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectGeneral.deleteProject",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "settings:projectGeneral.deleteModalConfirm",
      }),
    );

    await waitFor(() => expect(m.error).toHaveBeenCalledWith("Nope"));
    expect(m.navigate).not.toHaveBeenCalled();
  });
});
