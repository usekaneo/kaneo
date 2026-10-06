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
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>{node}</QueryClientProvider>,
    ),
  };
}

describe("advanced sync settings", () => {
  it("keeps a dirty rule draft while loading another paused-task page", async () => {
    useUserPreferencesStore.setState({ advancedSettings: true });
    const initial = {
      ...saved,
      labels: [
        ...saved.labels,
        { id: "label-2", name: "later", color: "#654321" },
      ],
      paused: 30,
      pausedNextCursor: "next-page",
    };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.get.mockImplementation(async (_params, after?: string) => {
      if (after) {
        await gate;
        return { ...initial, pausedNextCursor: null };
      }
      return initial;
    });
    mocks.save.mockResolvedValue(initial);
    mount();
    fireEvent.click(await screen.findByRole("checkbox", { name: "later" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "settings:syncRules.apply" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "settings:syncRules.next" }),
    );
    try {
      await waitFor(() =>
        expect(mocks.get).toHaveBeenCalledWith(param, "next-page"),
      );
      expect(screen.getByRole("checkbox", { name: "later" })).toBeChecked();
      expect(
        screen.getByRole("button", { name: "settings:syncRules.next" }),
      ).toBeDisabled();
    } finally {
      await act(async () => {
        release();
      });
    }
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "settings:syncRules.next" }),
      ).toBeDisabled(),
    );
    expect(screen.getByRole("checkbox", { name: "later" })).toBeChecked();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:syncRules.apply" }),
    );
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        param,
        {
          ...saved.rules,
          outgoing: {
            mode: "labels",
            match: "any",
            labels: ["label-1", "label-2"],
          },
        },
        "b".repeat(64),
      ),
    );
  });

  it.each([
    { projectId: "another-project", provider: "gitea" as const },
    { projectId: param.projectId, provider: "github" as const },
  ])(
    "does not show a previous integration's data while changing scope to %j",
    async (nextParam) => {
      useUserPreferencesStore.setState({ advancedSettings: true });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.get.mockImplementation(async (scope) => {
        if (
          scope.projectId === nextParam.projectId &&
          scope.provider === nextParam.provider
        )
          await gate;
        return saved;
      });
      const { client, rerender } = mount();
      await screen.findByRole("checkbox", { name: "sync" });
      rerender(
        <QueryClientProvider client={client}>
          <SyncRulesSection {...nextParam} />
        </QueryClientProvider>,
      );
      try {
        await waitFor(() =>
          expect(mocks.get).toHaveBeenCalledWith(nextParam, undefined),
        );
        expect(screen.queryByRole("checkbox", { name: "sync" })).toBeNull();
        expect(screen.getByRole("status")).toHaveTextContent(
          "settings:syncRules.loading",
        );
      } finally {
        await act(async () => {
          release();
        });
      }
    },
  );

  it.each(["apply", "reload"])(
    "keeps a dirty draft after shared rules change until %s",
    async (choice) => {
      useUserPreferencesStore.setState({ advancedSettings: true });
      const initial = {
        ...saved,
        labels: [
          ...saved.labels,
          { id: "label-2", name: "later", color: "#654321" },
        ],
      };
      mocks.get.mockResolvedValue(initial);
      const { client } = mount();
      fireEvent.click(await screen.findByRole("checkbox", { name: "later" }));
      const draft = {
        ...saved.rules,
        outgoing: {
          mode: "labels",
          match: "any",
          labels: ["label-1", "label-2"],
        },
      };
      act(() =>
        client.setQueryData(
          ["integration-sync", param.projectId, param.provider, ""],
          {
            ...initial,
            rules: { outgoing: { mode: "all" }, incoming: { mode: "all" } },
          },
        ),
      );
      await screen.findByText("settings:syncRules.rulesChanged");
      expect(screen.getByRole("checkbox", { name: "sync" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "later" })).toBeChecked();
      expect(mocks.save).not.toHaveBeenCalled();
      if (choice === "reload") {
        fireEvent.click(
          screen.getByRole("button", {
            name: "settings:syncRules.loadSavedRules",
          }),
        );
        expect(screen.queryByRole("checkbox")).toBeNull();
        expect(
          screen.queryByText("settings:syncRules.rulesChanged"),
        ).toBeNull();
        expect(mocks.save).not.toHaveBeenCalled();
      } else {
        const apply = screen.getByRole("button", {
          name: "settings:syncRules.apply",
        });
        await waitFor(() => expect(apply).toBeEnabled());
        fireEvent.click(apply);
        await waitFor(() =>
          expect(mocks.save).toHaveBeenCalledWith(param, draft, "b".repeat(64)),
        );
      }
    },
  );

  it("adopts refreshed shared rules when the editor has no draft changes", async () => {
    useUserPreferencesStore.setState({ advancedSettings: true });
    const { client } = mount();
    await screen.findByRole("checkbox", { name: "sync" });
    act(() =>
      client.setQueryData(
        ["integration-sync", param.projectId, param.provider, ""],
        {
          ...saved,
          rules: { outgoing: { mode: "all" }, incoming: { mode: "all" } },
        },
      ),
    );
    await waitFor(() => expect(screen.queryByRole("checkbox")).toBeNull());
    expect(screen.queryByText("settings:syncRules.rulesChanged")).toBeNull();
    expect(
      screen.getByRole("button", { name: "settings:syncRules.apply" }),
    ).toBeDisabled();
  });

  it("invalidates a cached rule preview after resuming a link", async () => {
    const { client } = mount(
      <ResumeSyncDialog
        param={param}
        linkId="link-1"
        taskId="task-1"
        onClose={vi.fn()}
      />,
    );
    const key = [
      "integration-sync-preview",
      param.projectId,
      param.provider,
      saved.rules,
    ];
    client.setQueryData(key, { ...saved, paused: 1, needsReview: 1 });
    await screen.findByText("Kaneo title");
    fireEvent.click(
      screen.getByRole("button", { name: "settings:syncRules.useKaneo" }),
    );
    await waitFor(() =>
      expect(client.getQueryState(key)?.isInvalidated).toBe(true),
    );
  });
  it("removes unavailable labels without resetting valid selections or match mode", async () => {
    useUserPreferencesStore.setState({ advancedSettings: true });
    mocks.get.mockResolvedValue({
      ...saved,
      missingLabels: ["deleted-label"],
      rules: {
        ...saved.rules,
        outgoing: {
          mode: "labels",
          match: "all",
          labels: ["label-1", "deleted-label"],
        },
      },
    });
    mount();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "settings:syncRules.removeMissingLabels",
      }),
    );
    expect(screen.getByRole("checkbox", { name: "sync" })).toBeChecked();
    const apply = screen.getByRole("button", {
      name: "settings:syncRules.apply",
    });
    await waitFor(() => expect(apply).toBeEnabled());
    fireEvent.click(apply);
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        param,
        {
          ...saved.rules,
          outgoing: { mode: "labels", match: "all", labels: ["label-1"] },
        },
        "b".repeat(64),
      ),
    );
  });

  it("refreshes an open comparison and submits its new token after invalidation", async () => {
    const { client } = mount(
      <ResumeSyncDialog
        param={param}
        linkId="link-1"
        taskId="task-1"
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("Kaneo title");
    mocks.review.mockResolvedValueOnce({
      task: { id: "task-1", number: 1, title: "Kaneo task" },
      local: {
        title: "Live Kaneo title",
        description: "Local body",
        state: "open",
      },
      remote: {
        title: "Repository title",
        description: "Remote body",
        state: "closed",
      },
      token: "d".repeat(64),
    });
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ["integration-sync-review", param.projectId],
      });
    });
    expect(await screen.findByText("Live Kaneo title")).toBeVisible();
    expect(screen.queryByText("Kaneo title")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:syncRules.useKaneo" }),
    );
    await waitFor(() =>
      expect(mocks.resume).toHaveBeenCalledWith(
        param,
        "link-1",
        "d".repeat(64),
        "kaneo",
      ),
    );
  });

  it("refreshes cached issue metadata after saving rules", async () => {
    useUserPreferencesStore.setState({ advancedSettings: true });
    mocks.get.mockResolvedValue({ ...saved, willCreate: 1 });
    const { client } = mount();
    client.setQueryData(["external-links", "task-1"], [{ metadata: "{}" }]);
    const apply = await screen.findByRole("button", {
      name: "settings:syncRules.exportPending",
    });
    await waitFor(() => expect(apply).toBeEnabled());
    fireEvent.click(apply);
    await waitFor(() =>
      expect(
        client.getQueryState(["external-links", "task-1"])?.isInvalidated,
      ).toBe(true),
    );
  });

  it("shows a retry after a failed refresh even when rules were cached", async () => {
    const { client } = mount();
    await screen.findByText("settings:syncRules.anySummary");
    mocks.get.mockRejectedValueOnce(new Error("Unavailable"));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["integration-sync"] });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "settings:syncRules.loadError",
    );
    expect(screen.queryByText("settings:syncRules.anySummary")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "common:error.tryAgain" }),
    );
    expect(
      await screen.findByText("settings:syncRules.anySummary"),
    ).toBeVisible();
  });

  it("stops at 50 labels while allowing a selected label to be removed", async () => {
    useUserPreferencesStore.setState({ advancedSettings: true });
    const labels = Array.from({ length: 51 }, (_, i) => ({
      id: `label-${i + 1}`,
      name: `Label ${i + 1}`,
      color: "#123456",
    }));
    mocks.get.mockResolvedValue({
      ...saved,
      labels,
      rules: {
        ...saved.rules,
        outgoing: {
          mode: "labels",
          match: "any",
          labels: labels.slice(0, 50).map((label) => label.id),
        },
      },
    });
    mount();
    const extra = await screen.findByRole("checkbox", { name: "Label 51" });
    expect(extra).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(extra);
    expect(extra).not.toBeChecked();
    const selected = screen.getByRole("checkbox", { name: "Label 1" });
    expect(selected).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(selected);
    expect(extra).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(extra);
    expect(selected).toHaveAttribute("aria-disabled", "true");
    expect(extra).toBeChecked();
  });

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
    mount(
      <ResumeSyncDialog
        param={param}
        linkId="link-1"
        taskId="task-1"
        onClose={onClose}
      />,
    );
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
