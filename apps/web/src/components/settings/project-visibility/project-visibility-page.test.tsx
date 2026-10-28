import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ProjectVisibilityPage } from "./project-visibility-page";

const m = vi.hoisted(() => ({
  project: { id: "p1", name: "Website", isPublic: false } as {
    id: string;
    name: string;
    isPublic: boolean;
  },
  canShare: false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ projectId: "p1" }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1", name: "Studio" } }),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: () => ({ data: m.project }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    hasPermission: async () => m.canShare,
  }),
}));
vi.mock("@/hooks/mutations/project/use-update-project", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("ProjectVisibilityPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    m.project = { id: "p1", name: "Website", isPublic: false };
    m.canShare = false;
  });

  it("hides the link while the project is private", () => {
    render(<ProjectVisibilityPage />);

    expect(
      screen.queryByLabelText("settings:projectVisibility.publicUrl"),
    ).toBeNull();
    expect(screen.queryByText("settings:projectVisibility.on")).toBeNull();
  });

  it("shows the badge and the link while the project is public", () => {
    m.project = { ...m.project, isPublic: true };
    render(<ProjectVisibilityPage />);

    expect(screen.getByText("settings:projectVisibility.on")).toBeTruthy();
    expect(
      screen.getByLabelText("settings:projectVisibility.publicUrl"),
    ).toHaveValue(`${window.location.origin}/public-project/p1`);
  });

  it("keeps the switch disabled until sharing is allowed", async () => {
    const { unmount } = render(<ProjectVisibilityPage />);
    expect(
      screen.getByRole("switch", {
        name: "settings:projectVisibility.publicAccess",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    unmount();

    m.canShare = true;
    render(<ProjectVisibilityPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("switch", {
          name: "settings:projectVisibility.publicAccess",
        }),
      ).not.toHaveAttribute("aria-disabled", "true"),
    );
  });
});
