import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
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
import type { CreateGiteaIntegrationRequest } from "@/fetchers/gitea-integration/create-gitea-integration";
import type { UpdateGiteaIntegrationRequest } from "@/fetchers/gitea-integration/update-gitea-integration";
import { GiteaIntegrationSettings } from "./gitea-integration-settings";

type IssueSyncMode = "sync" | "ingest-only" | "off";
type SavedIntegration = {
  id: string;
  baseUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  isActive: boolean;
  issueSyncMode: IssueSyncMode;
  commentTaskLinkOnGiteaIssue: boolean;
};
const {
  verify,
  success,
  failure,
  get,
  create,
  update,
  importIssues,
  server,
  translate,
} = vi.hoisted(() => ({
  verify: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  importIssues: vi.fn(),
  server: { integration: null as SavedIntegration | null },
  translate: (key: string) => key,
}));
const permissions = vi.hoisted(() => ({ create: true, update: true }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => permissions.create,
    canUpdateTasks: () => permissions.update,
  }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/fetchers/gitea-integration/get-gitea-integration", () => ({
  default: get,
}));
vi.mock("@/fetchers/gitea-integration/create-gitea-integration", () => ({
  default: create,
}));
vi.mock("@/fetchers/gitea-integration/verify-gitea-access", () => ({
  default: verify,
}));
vi.mock("@/fetchers/gitea-integration/update-gitea-integration", () => ({
  default: update,
}));
vi.mock("@/fetchers/gitea-integration/import-gitea-issues", () => ({
  default: importIssues,
}));
vi.mock("@/components/project/gitea-repository-browser-modal", () => ({
  GiteaRepositoryBrowserModal: () => null,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success, error: failure, warning: vi.fn() },
}));
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <GiteaIntegrationSettings projectId="project" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  server.integration = {
    id: "integration",
    baseUrl: "https://gitea.example",
    repositoryOwner: "owner",
    repositoryName: "repo",
    isActive: true,
    issueSyncMode: "sync",
    commentTaskLinkOnGiteaIssue: true,
  };
  get.mockImplementation(
    async () => server.integration && { ...server.integration },
  );
  verify.mockResolvedValue({
    isInstalled: true,
    hasRequiredPermissions: true,
    message: "Access verified",
  });
  update.mockImplementation(
    async (_projectId: string, json: UpdateGiteaIntegrationRequest) => {
      server.integration = { ...server.integration!, ...json };
      return server.integration;
    },
  );
  importIssues.mockResolvedValue({ imported: 1 });
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  permissions.create = true;
  permissions.update = true;
  vi.clearAllMocks();
});
describe("saved Gitea verification", () => {
  it("verifies an existing integration without exposing or reentering its saved token", async () => {
    verify.mockResolvedValue({
      isInstalled: true,
      hasRequiredPermissions: true,
    });
    mount();
    const button = await screen.findByRole("button", {
      name: "settings:giteaIntegration.verify",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(
      screen.getByRole("button", {
        name: "settings:giteaIntegration.importIssues",
      }),
    ).toBeEnabled();
  });
  it("shows verification errors for a saved integration", async () => {
    verify.mockRejectedValue(new Error("Verification failed"));
    mount();
    const button = await screen.findByRole("button", {
      name: "settings:giteaIntegration.verify",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() =>
      expect(failure).toHaveBeenCalledWith("Verification failed"),
    );
    expect(success).not.toHaveBeenCalled();
  });
});

it.each(["create", "update"] as const)(
  "disables verified Gitea imports without %s permission",
  async (permission) => {
    permissions[permission] = false;
    verify.mockResolvedValue({
      isInstalled: true,
      hasRequiredPermissions: true,
    });
    mount();
    const verifyButton = await screen.findByRole("button", {
      name: "settings:giteaIntegration.verify",
    });
    await waitFor(() => expect(verifyButton).toBeEnabled());
    fireEvent.click(verifyButton);
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(
      screen.getByRole("button", {
        name: "settings:giteaIntegration.importIssues",
      }),
    ).toBeDisabled();
    expect(
      screen.getByText("settings:gitlabIntegration.importPermissionHint"),
    ).toBeInTheDocument();
  },
);

const modeNames = {
  sync: "settings:giteaIntegration.issueSyncMode.sync",
  "ingest-only": "settings:giteaIntegration.issueSyncMode.ingestOnly",
  off: "settings:giteaIntegration.issueSyncMode.off",
};
async function selectMode(mode: IssueSyncMode) {
  fireEvent.click(await screen.findByRole("combobox"));
  const option = await screen.findByRole("option", { name: modeNames[mode] });
  // BaseUI ignores bare clicks on unhighlighted options: start the pointer
  // interaction on the option, as a consumer's mouse activation does.
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.mouseDown(option, { button: 0 });
  fireEvent.pointerUp(option, { pointerType: "mouse", button: 0 });
  fireEvent.mouseUp(option, { button: 0 });
  fireEvent.click(option, { detail: 1 });
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
}
async function verifySavedAccess() {
  const button = await screen.findByRole("button", {
    name: "settings:giteaIntegration.verify",
  });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await screen.findByText("Access verified");
}
function backlinkControl() {
  return screen.getByRole("switch", {
    name: "settings:giteaIntegration.commentTaskLinkTitle",
  });
}
function expectBacklinkBlocked() {
  const control = backlinkControl();
  // The shared Switch renders a span: native toBeDisabled() does not apply.
  // Prove activation cannot change saved state as well as its ARIA contract.
  expect(control).toHaveAttribute("aria-disabled", "true");
  const checked = control.getAttribute("aria-checked");
  const writes = update.mock.calls.length;
  fireEvent.click(control);
  fireEvent.keyDown(control, { key: " " });
  fireEvent.keyUp(control, { key: " " });
  expect(control).toHaveAttribute("aria-checked", checked);
  expect(update.mock.calls).toHaveLength(writes);
}
function importButton() {
  return screen.getByRole("button", {
    name: "settings:giteaIntegration.importIssues",
  });
}

describe("Gitea issue sync modes", () => {
  it.each(["ingest-only", "off"] as const)(
    "keeps the saved mode during PATCH and applies successful %s without stale verification",
    async (mode) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const save = update.getMockImplementation()!;
      update.mockImplementation(async (projectId, json) => {
        await gate;
        return save(projectId, json);
      });
      mount();
      await verifySavedAccess();
      expect(importButton()).toBeEnabled();
      expect(backlinkControl()).not.toHaveAttribute("aria-disabled", "true");
      await selectMode(mode);
      try {
        await waitFor(() =>
          expect(screen.getByRole("combobox")).toBeDisabled(),
        );
        expect(screen.getByRole("combobox")).toHaveTextContent(modeNames.sync);
        expect(importButton()).toBeDisabled();
        expectBacklinkBlocked();
      } finally {
        await act(async () => {
          release();
        });
      }
      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeEnabled();
        expect(screen.getByRole("combobox")).toHaveTextContent(modeNames[mode]);
      });
      expect(screen.queryByText("Access verified")).not.toBeInTheDocument();
      expect(importButton()).toBeDisabled();
      expectBacklinkBlocked();
      await verifySavedAccess();
      if (mode === "off") {
        expect(importButton()).toBeDisabled();
        expect(
          screen.getByText(
            "settings:giteaIntegration.issueSyncMode.importDisabledHint",
          ),
        ).toBeInTheDocument();
      } else {
        expect(importButton()).toBeEnabled();
      }
      await selectMode("sync");
      await waitFor(() =>
        expect(backlinkControl()).not.toHaveAttribute("aria-disabled", "true"),
      );
      expect(importButton()).toBeDisabled();
      await verifySavedAccess();
      expect(importButton()).toBeEnabled();
      fireEvent.click(backlinkControl());
      await waitFor(() => expect(backlinkControl()).not.toBeChecked());
    },
  );

  it.each(["ingest-only", "off"] as const)(
    "retains saved %s and reports a denied PATCH without enabling writes",
    async (mode) => {
      server.integration!.issueSyncMode = mode;
      update.mockRejectedValue(
        new Error("Token requires issue-write permission to enable Sync"),
      );
      mount();
      await verifySavedAccess();
      if (mode === "off") expect(importButton()).toBeDisabled();
      else expect(importButton()).toBeEnabled();
      await selectMode("sync");
      await waitFor(() =>
        expect(failure).toHaveBeenCalledWith(
          "Token requires issue-write permission to enable Sync",
        ),
      );
      expect(screen.getByRole("combobox")).toHaveTextContent(modeNames[mode]);
      expect(screen.getByRole("combobox")).toBeEnabled();
      expectBacklinkBlocked();
      if (mode === "off") expect(importButton()).toBeDisabled();
      else expect(importButton()).toBeEnabled();
      expect(screen.getByText("Access verified")).toBeInTheDocument();
      expect(success).not.toHaveBeenCalledWith(
        "settings:giteaIntegration.toast.updated",
      );
    },
  );

  it.each(["ingest-only", "off"] as const)(
    "does not offer backlink writes in saved %s mode",
    async (mode) => {
      server.integration!.issueSyncMode = mode;
      mount();
      await verifySavedAccess();
      expect(backlinkControl()).toBeChecked();
      expectBacklinkBlocked();
      fireEvent.click(backlinkControl());
      expect(backlinkControl()).toBeChecked();
      expect(update).not.toHaveBeenCalled();
      expect(
        screen.getByText(
          "settings:giteaIntegration.issueSyncMode.backlinkDisabledHint",
        ),
      ).toBeInTheDocument();
      if (mode === "off") {
        expect(importButton()).toBeDisabled();
        fireEvent.click(importButton());
        expect(importIssues).not.toHaveBeenCalled();
        expect(
          screen.getByText(
            "settings:giteaIntegration.issueSyncMode.importDisabledHint",
          ),
        ).toBeInTheDocument();
      } else {
        expect(importButton()).toBeEnabled();
        fireEvent.click(importButton());
        await waitFor(() =>
          expect(success).toHaveBeenCalledWith(
            "settings:giteaIntegration.toast.issuesImported",
          ),
        );
      }
    },
  );
});

describe("credential mode admission", () => {
  it.each(["sync", "ingest-only", "off"] as const)(
    "connects new credentials using selected %s admission",
    async (mode) => {
      server.integration = null;
      // Model the API's permission gate, rather than returning whatever was sent.
      // A read-only token can connect in restricted modes, never in Sync.
      verify.mockImplementation(async ({ issueSyncMode }) => ({
        isInstalled: true,
        hasRequiredPermissions: issueSyncMode !== "sync",
        message:
          issueSyncMode === "sync"
            ? "Issue-write permission required"
            : "Read access verified",
      }));
      create.mockImplementation(
        async (_projectId: string, data: CreateGiteaIntegrationRequest) => {
          if (data.issueSyncMode !== mode || mode === "sync")
            throw new Error("Issue-write permission required");
          server.integration = {
            id: "new-integration",
            baseUrl: data.baseUrl,
            repositoryOwner: data.repositoryOwner,
            repositoryName: data.repositoryName,
            isActive: true,
            issueSyncMode: mode,
            commentTaskLinkOnGiteaIssue: true,
          };
          return server.integration;
        },
      );
      mount();
      await screen.findByRole("combobox");
      if (mode !== "sync") await selectMode(mode);
      fireEvent.change(
        screen.getByLabelText("settings:giteaIntegration.baseUrlLabel"),
        { target: { value: "https://gitea.example" } },
      );
      fireEvent.change(
        screen.getByLabelText("settings:giteaIntegration.ownerLabel"),
        { target: { value: "reader" } },
      );
      fireEvent.change(
        screen.getByLabelText("settings:giteaIntegration.repoNameLabel"),
        { target: { value: "issues" } },
      );
      const token = screen.getByLabelText(
        "settings:giteaIntegration.tokenLabel",
      );
      fireEvent.change(token, { target: { value: "read-only-token" } });
      const connect = screen.getByRole("button", {
        name: "settings:giteaIntegration.connect",
      });
      await waitFor(() => expect(connect).toBeEnabled());
      fireEvent.click(connect);
      if (mode === "sync") {
        await waitFor(() =>
          expect(failure).toHaveBeenCalledWith(
            "settings:giteaIntegration.toast.verifyFirst",
          ),
        );
        expect(token).toHaveValue("read-only-token");
        expect(screen.queryByText("reader/issues")).not.toBeInTheDocument();
        expect(
          screen.getByRole("button", {
            name: "settings:giteaIntegration.connect",
          }),
        ).toBeInTheDocument();
        expect(create).not.toHaveBeenCalled();
      } else {
        await screen.findByText("reader/issues");
        expect(token).toHaveValue("");
        expect(screen.getByRole("combobox")).toHaveTextContent(modeNames[mode]);
        expectBacklinkBlocked();
        expect(importButton()).toBeDisabled();
        expect(
          screen.getByRole("button", {
            name: "settings:giteaIntegration.update",
          }),
        ).toBeInTheDocument();
      }
    },
  );

  it.each(["sync", "ingest-only", "off"] as const)(
    "admits replacement read-only credentials according to saved %s mode without overwriting it",
    async (mode) => {
      server.integration!.issueSyncMode = mode;
      verify.mockImplementation(async ({ issueSyncMode }) => ({
        isInstalled: true,
        hasRequiredPermissions: issueSyncMode === mode && mode !== "sync",
        message:
          mode === "sync"
            ? "Issue-write permission required"
            : "Read access verified",
      }));
      create.mockImplementation(
        async (_projectId: string, data: CreateGiteaIntegrationRequest) => {
          if (data.issueSyncMode !== undefined)
            throw new Error("Use settings PATCH to change an existing mode");
          server.integration = {
            ...server.integration!,
            repositoryName: data.repositoryName,
          };
          return server.integration;
        },
      );
      mount();
      const token = await screen.findByLabelText(
        "settings:giteaIntegration.tokenLabel",
      );
      fireEvent.change(
        screen.getByLabelText("settings:giteaIntegration.repoNameLabel"),
        { target: { value: "replacement" } },
      );
      fireEvent.change(token, { target: { value: "replacement-read-token" } });
      const save = screen.getByRole("button", {
        name: "settings:giteaIntegration.update",
      });
      await waitFor(() => expect(save).toBeEnabled());
      fireEvent.click(save);
      if (mode === "sync") {
        await waitFor(() =>
          expect(failure).toHaveBeenCalledWith(
            "settings:giteaIntegration.toast.verifyFirst",
          ),
        );
        expect(screen.getByText("owner/repo")).toBeInTheDocument();
        expect(screen.queryByText("owner/replacement")).not.toBeInTheDocument();
        expect(token).toHaveValue("replacement-read-token");
        expect(create).not.toHaveBeenCalled();
      } else {
        await screen.findByText("owner/replacement");
        expect(token).toHaveValue("");
        expectBacklinkBlocked();
        expect(failure).not.toHaveBeenCalled();
      }
      expect(screen.getByRole("combobox")).toHaveTextContent(modeNames[mode]);
      expect(importButton()).toBeDisabled();
      expect(update).not.toHaveBeenCalled();
    },
  );
});
