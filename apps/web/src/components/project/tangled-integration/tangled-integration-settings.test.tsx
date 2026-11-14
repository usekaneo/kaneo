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
import { TangledIntegrationSettings } from "./tangled-integration-settings";

const state = vi.hoisted(() => ({
  data: null as null | Record<string, unknown>,
  error: false,
  canManage: true,
  save: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canManageSettings: () => state.canManage }),
}));
vi.mock("@/hooks/queries/tangled-integration/use-tangled-integration", () => ({
  useTangledIntegration: () => ({
    data: state.data,
    isLoading: false,
    isError: state.error,
    refetch: vi.fn(),
    save: state.save,
    disconnect: state.disconnect,
    isPending: false,
  }),
}));
vi.mock("@/hooks/queries/tangled-integration/use-tangled-outcome", () => ({
  useTangledOutcome: () => ({ data: null, isError: false, isLoading: false }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  state.data = null;
  state.error = false;
  state.canManage = true;
  state.save.mockReset().mockResolvedValue({});
  state.disconnect.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("Tangled integration settings", () => {
  it("requires a secret for a new connection and sends the configured repository identifiers", async () => {
    render(<TangledIntegrationSettings projectId="project" />);
    fireEvent.change(
      screen.getByLabelText("settings:tangledIntegration.repositoryDid"),
      { target: { value: "did:plc:repo" } },
    );
    fireEvent.change(
      screen.getByLabelText("settings:tangledIntegration.repositoryId"),
      { target: { value: "did:plc:owner/repo" } },
    );
    fireEvent.change(
      screen.getByLabelText("settings:tangledIntegration.repositoryUrl"),
      { target: { value: "https://tangled.org/owner/repo" } },
    );
    expect(
      screen.getByRole("button", {
        name: "settings:tangledIntegration.connect",
      }),
    ).toBeDisabled();
    fireEvent.change(
      screen.getByLabelText("settings:tangledIntegration.secret"),
      { target: { value: "private-secret" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:tangledIntegration.connect",
      }),
    );
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          repositoryDid: "did:plc:repo",
          repositoryId: "did:plc:owner/repo",
          webhookSecret: "private-secret",
          isActive: true,
        }),
      ),
    );
  });

  it("does not resend the saved secret when editing an existing connection", async () => {
    state.data = {
      integrationId: "id1",
      webhookUrl:
        "https://api.example.test/api/tangled-integration/webhook/id1",
      baseUrl: "https://api.tangled.org",
      repositoryDid: "did:plc:repo",
      repositoryId: "did:plc:owner/repo",
      repositoryUrl: "https://tangled.org/owner/repo",
      branchPattern: "{slug}-{number}",
      isActive: true,
      hasSecret: true,
    };
    render(<TangledIntegrationSettings projectId="project" />);
    expect(
      screen.getByLabelText("settings:tangledIntegration.secret"),
    ).toHaveValue("");
    expect(
      (
        screen.getByLabelText(
          "settings:tangledIntegration.webhookUrl",
        ) as HTMLInputElement
      ).value,
    ).toContain("/api/tangled-integration/webhook/id1");
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:chatIntegrations.saveChanges",
      }),
    );
    await waitFor(() => expect(state.save).toHaveBeenCalled());
    expect(state.save.mock.calls[0]![0]).not.toHaveProperty("webhookSecret");
  });

  it("disables editing for users without workspace management permission", () => {
    state.canManage = false;
    render(<TangledIntegrationSettings projectId="project" />);
    expect(
      screen.getByLabelText("settings:tangledIntegration.repositoryDid"),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", {
        name: "settings:tangledIntegration.connect",
      }),
    ).toBeNull();
  });

  it("shows a retry control instead of an empty connection form on load failure", () => {
    state.error = true;
    render(<TangledIntegrationSettings projectId="project" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "settings:tangledIntegration.loadError",
    );
    expect(
      screen.queryByRole("button", {
        name: "settings:tangledIntegration.connect",
      }),
    ).toBeNull();
  });
});
