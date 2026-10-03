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
import type { SyncPreview } from "@/fetchers/integration-sync/types";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { ResumeSyncDialog } from "./resume-sync-dialog";
import { SyncRulesSection } from "./sync-rules-section";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  preview: vi.fn(),
  save: vi.fn(),
  review: vi.fn(),
  resume: vi.fn(),
  canManage: true,
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canManageSettings: () => mocks.canManage,
    canUpdateTasks: () => mocks.canManage,
  }),
}));
vi.mock("@/fetchers/integration-sync/get-sync-rules", () => ({
  default: mocks.get,
}));
vi.mock("@/fetchers/integration-sync/preview-sync-rules", () => ({
  default: mocks.preview,
}));
vi.mock("@/fetchers/integration-sync/save-sync-rules", () => ({
  default: mocks.save,
}));
vi.mock("@/fetchers/integration-sync/review-sync-resume", () => ({
  default: mocks.review,
}));
vi.mock("@/fetchers/integration-sync/resume-sync", () => ({
  default: mocks.resume,
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn() } }));

const param = { projectId: "project-1", provider: "gitea" as const };
const saved: SyncPreview = {
  isActive: true,
  rules: {
    outgoing: { mode: "labels", match: "any", labels: ["label-1"] },
    incoming: { mode: "all" },
  },
  labels: [{ id: "label-1", name: "sync", color: "#123456" }],
  missingLabels: [],
  total: 2,
  matching: 1,
  willCreate: 0,
  willPause: 0,
  needsReview: 0,
  paused: 0,
  matchingTasks: [{ id: "task-1", title: "Matching task", number: 1 }],
  pausedTasks: [],
  pausedNextCursor: null,
  previewToken: "a".repeat(64),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canManage = true;
  useUserPreferencesStore.setState({ advancedSettings: false });
  mocks.get.mockResolvedValue(saved);
  mocks.preview.mockResolvedValue({ ...saved, previewToken: "b".repeat(64) });
  mocks.review.mockResolvedValue({
    task: { id: "task-1", number: 1, title: "Kaneo task" },
    local: { title: "Kaneo title", description: "Local body", state: "open" },
    remote: {
      title: "Repository title",
      description: "Remote body",
      state: "closed",
    },
    token: "c".repeat(64),
  });
});
afterEach(cleanup);
function mount(node = <SyncRulesSection {...param} />) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
}

describe("advanced sync settings", () => {
  it("offers an explicit retry for eligible tasks without an issue link", async () => {
    useUserPreferencesStore.setState({ advancedSettings: true });
    mocks.get.mockResolvedValue({ ...saved, willCreate: 1 });
    mount();
    const retry = await screen.findByRole("button", {
      name: "settings:syncRules.exportPending",
    });
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        param,
        saved.rules,
        "b".repeat(64),
      ),
    );
  });
  it("shows the active rule while advanced mode is off and preserves it when toggled", async () => {
    mount();
    await screen.findByText("settings:syncRules.advancedHint");
    expect(screen.getByText("settings:syncRules.anySummary")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "settings:syncRules.apply" }),
    ).toBeNull();
    act(() => useUserPreferencesStore.getState().setAdvancedSettings(true));
    expect(await screen.findByRole("checkbox", { name: "sync" })).toBeChecked();
    act(() => useUserPreferencesStore.getState().setAdvancedSettings(false));
    expect(screen.queryByRole("checkbox", { name: "sync" })).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("requires a selected label and a current impact preview before saving", async () => {
    useUserPreferencesStore.setState({ advancedSettings: true });
    mount();
    const checkbox = await screen.findByRole("checkbox", { name: "sync" });
    const apply = screen.getByRole("button", {
      name: "settings:syncRules.apply",
    });
    fireEvent.click(checkbox);
    expect(apply).toBeDisabled();
    expect(mocks.preview).not.toHaveBeenCalled();
    // Restore the saved rule, then add a repository-side filter to create a valid draft.
    fireEvent.click(checkbox);
    fireEvent.click(
      screen.getByRole("combobox", { name: "settings:syncRules.incoming" }),
      { detail: 1 },
    );
    const option = await screen.findByRole("option", {
      name: "settings:syncRules.filtered",
    });
    fireEvent.pointerDown(option);
    fireEvent.mouseDown(option);
    fireEvent.pointerUp(option);
    fireEvent.mouseUp(option);
    fireEvent.click(option, { detail: 1 });
    fireEvent.change(
      await screen.findByRole("textbox", {
        name: "settings:syncRules.repositoryLabel",
      }),
      { target: { value: "ready" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "settings:syncRules.addLabel" }),
    );
    await waitFor(() => expect(apply).toBeEnabled());
    fireEvent.click(apply);
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        param,
        expect.objectContaining({
          incoming: { mode: "labels", match: "any", labels: ["ready"] },
        }),
        "b".repeat(64),
      ),
    );
  });

  it("shows shared rules to members without an editor or resume controls", async () => {
    mocks.canManage = false;
    useUserPreferencesStore.setState({ advancedSettings: true });
    mocks.get.mockResolvedValue({
      ...saved,
      paused: 1,
      pausedTasks: [
        {
          id: "task-1",
          number: 1,
          title: "Paused task",
          linkId: "link-1",
          url: "https://git.example/1",
          eligible: true,
        },
      ],
    });
    mount();
    await screen.findByText("Paused task");
    expect(
      screen.queryByRole("button", { name: "settings:syncRules.review" }),
    ).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("keeps the comparison open and requires refresh after a failed resume", async () => {
    const onClose = vi.fn();
    mocks.resume.mockRejectedValue(new Error("Comparison changed"));
    mount(<ResumeSyncDialog param={param} linkId="link-1" onClose={onClose} />);
    await screen.findByText("Repository title");
    const keepLocal = screen.getByRole("button", {
      name: "settings:syncRules.useKaneo",
    });
    fireEvent.click(keepLocal);
    await screen.findByText("settings:syncRules.resumeError");
    expect(onClose).not.toHaveBeenCalled();
    expect(keepLocal).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:syncRules.refreshComparison",
      }),
    );
    await waitFor(() => expect(keepLocal).toBeEnabled());
    expect(mocks.review).toHaveBeenCalledTimes(2);
  });
});
