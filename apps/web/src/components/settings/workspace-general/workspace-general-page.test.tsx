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
import { WorkspaceGeneralPage } from "./workspace-general-page";

const m = vi.hoisted(() => ({
  update: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  isOwner: true,
  canDelete: true,
  members: [] as Array<{
    id: string;
    role: string;
    userId: string;
    user: { name: string; email: string; image: string | null };
  }>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({
    data: { id: "w1", name: "Studio", description: "", metadata: null },
  }),
}));
vi.mock("@/hooks/queries/workspace/use-get-full-workspace", () => ({
  default: () => ({ data: { members: m.members } }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canManageWorkspace: () => true,
    canDeleteWorkspace: () => m.canDelete,
    isOwner: m.isOwner,
  }),
}));
vi.mock("@/hooks/mutations/workspace/use-update-workspace", () => ({
  default: () => ({ mutateAsync: m.update }),
}));
vi.mock("@/hooks/mutations/workspace/use-delete-workspace", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/workspace/use-transfer-workspace-ownership", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.error },
}));

const owner = {
  id: "m1",
  role: "owner",
  userId: "u1",
  user: { name: "Owner Person", email: "owner@example.com", image: null },
};

describe("WorkspaceGeneralPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    m.update.mockResolvedValue(undefined);
    m.isOwner = true;
    m.canDelete = true;
    m.members = [owner];
  });

  it("shows the owner and the invite hint when nobody else can take over", () => {
    render(<WorkspaceGeneralPage />);

    expect(screen.getByText("Owner Person")).toBeTruthy();
    expect(
      screen.getByText(
        "settings:workspaceGeneral.transferOwnership.noEligibleMembers",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "settings:workspaceGeneral.transferOwnership.button",
      }),
    ).toBeDisabled();
  });

  it("hides ownership and the danger zone from people without access", () => {
    m.isOwner = false;
    m.canDelete = false;
    render(<WorkspaceGeneralPage />);

    expect(
      screen.queryByText("settings:workspaceGeneral.ownershipTitle"),
    ).toBeNull();
    expect(
      screen.queryByText("settings:workspaceGeneral.dangerZone"),
    ).toBeNull();
  });

  it("no longer carries the advanced settings switch", () => {
    render(<WorkspaceGeneralPage />);

    expect(screen.queryByText("settings:advancedSettings")).toBeNull();
  });

  it("saves the name without a success toast", async () => {
    render(<WorkspaceGeneralPage />);

    fireEvent.change(
      screen.getByLabelText("settings:workspaceGeneral.nameLabel"),
      { target: { value: "Studio North" } },
    );

    await waitFor(
      () =>
        expect(m.update).toHaveBeenCalledWith({
          workspaceId: "w1",
          name: "Studio North",
        }),
      { timeout: 3000 },
    );
    expect(m.success).not.toHaveBeenCalled();
  });
});
