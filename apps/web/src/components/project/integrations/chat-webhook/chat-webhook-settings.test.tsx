import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { toChatEvents } from "./chat-events";
import type {
  ChatWebhookIntegration,
  ChatWebhookProvider,
} from "./chat-webhook-provider";
import {
  mattermostChatProvider,
  slackChatProvider,
} from "./chat-webhook-providers";
import { ChatWebhookSettings } from "./chat-webhook-settings";

const mocks = vi.hoisted(() => ({
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const slackUrl = "https://hooks.slack.com/services/T000/B000/XXXX";

const connectedIntegration: ChatWebhookIntegration = {
  id: "integration-1",
  channelName: "#launch",
  webhookConfigured: true,
  events: toChatEvents(),
  isActive: true,
};

function withHooks(
  base: ChatWebhookProvider,
  integration: ChatWebhookIntegration,
  isLoading = false,
): ChatWebhookProvider {
  return {
    ...base,
    useIntegration: () => ({ data: integration, isLoading }),
    useCreateIntegration: () => ({
      mutateAsync: mocks.createIntegration,
      isPending: false,
    }),
    useUpdateIntegration: () => ({
      mutateAsync: mocks.updateIntegration,
      isPending: false,
    }),
    useDeleteIntegration: () => ({
      mutateAsync: mocks.deleteIntegration,
      isPending: false,
    }),
  };
}

function renderSettings(provider: ChatWebhookProvider) {
  return render(
    <ChatWebhookSettings projectId="project-1" provider={provider} />,
  );
}

describe("ChatWebhookSettings", () => {
  afterEach(cleanup);

  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.createIntegration.mockResolvedValue(undefined);
    mocks.updateIntegration.mockResolvedValue(undefined);
    mocks.deleteIntegration.mockResolvedValue(undefined);
  });

  it("shows one skeleton while loading", () => {
    renderSettings(withHooks(slackChatProvider, null, true));

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("rejects a URL that does not belong to the provider", async () => {
    renderSettings(withHooks(slackChatProvider, null));

    expect(screen.queryByRole("switch")).toBeNull();
    fireEvent.change(
      screen.getByLabelText("settings:chatIntegrations.webhookUrlLabel"),
      { target: { value: "https://example.com/hooks/kaneo" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "settings:slackIntegration.connect" }),
    );

    expect(
      await screen.findByText(
        "settings:slackIntegration.validation.webhookInvalid",
      ),
    ).toBeTruthy();
    expect(mocks.createIntegration).not.toHaveBeenCalled();
  });

  it("connects with the chosen events", async () => {
    renderSettings(withHooks(slackChatProvider, null));

    fireEvent.change(
      screen.getByLabelText("settings:chatIntegrations.webhookUrlLabel"),
      { target: { value: slackUrl } },
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "settings:chatIntegrations.events.taskPriorityChanged",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "settings:slackIntegration.connect" }),
    );

    await waitFor(() =>
      expect(mocks.createIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        data: {
          webhookUrl: slackUrl,
          channelName: undefined,
          events: { ...toChatEvents(), taskPriorityChanged: true },
        },
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "settings:slackIntegration.toast.saved",
    );
  });

  it("keeps the saved URL when the field is left empty", async () => {
    renderSettings(withHooks(slackChatProvider, connectedIntegration));

    const urlInput = screen.getByLabelText(
      "settings:chatIntegrations.webhookUrlLabel",
    );
    expect(urlInput).toHaveAttribute(
      "placeholder",
      "settings:chatIntegrations.savedUrlPlaceholder",
    );
    expect(urlInput).toHaveValue("");

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:chatIntegrations.saveChanges",
      }),
    );

    await waitFor(() =>
      expect(mocks.updateIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        json: {
          webhookUrl: undefined,
          channelName: "#launch",
          events: toChatEvents(),
        },
      }),
    );
  });

  it("clears a replaced URL from the field after saving", async () => {
    renderSettings(withHooks(slackChatProvider, connectedIntegration));

    const urlInput = screen.getByLabelText(
      "settings:chatIntegrations.webhookUrlLabel",
    );
    fireEvent.change(urlInput, { target: { value: slackUrl } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:chatIntegrations.saveChanges",
      }),
    );

    await waitFor(() =>
      expect(mocks.updateIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          json: expect.objectContaining({ webhookUrl: slackUrl }),
        }),
      ),
    );
    await waitFor(() => expect(urlInput).toHaveValue(""));
  });

  it("pauses posting from the switch row", async () => {
    renderSettings(withHooks(slackChatProvider, connectedIntegration));

    fireEvent.click(
      screen.getByRole("switch", {
        name: "settings:chatIntegrations.activeTitle",
      }),
    );

    await waitFor(() =>
      expect(mocks.updateIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        json: { isActive: false },
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "settings:slackIntegration.toast.disabled",
      { icon: expect.anything() },
    );
  });

  it("disconnects only after confirmation", async () => {
    renderSettings(withHooks(slackChatProvider, connectedIntegration));

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:chatIntegrations.disconnect",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("settings:chatIntegrations.disconnectTitle"),
    ).toBeTruthy();
    expect(mocks.deleteIntegration).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:chatIntegrations.disconnect",
      }),
    );

    await waitFor(() =>
      expect(mocks.deleteIntegration).toHaveBeenCalledWith("project-1"),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "settings:slackIntegration.toast.removed",
      { icon: expect.anything() },
    );
  });

  it("clears the Mattermost channel with null", async () => {
    renderSettings(withHooks(mattermostChatProvider, connectedIntegration));

    fireEvent.change(
      screen.getByLabelText(/settings:chatIntegrations\.channelLabel/),
      { target: { value: "" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:chatIntegrations.saveChanges",
      }),
    );

    await waitFor(() =>
      expect(mocks.updateIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          json: expect.objectContaining({ channelName: null }),
        }),
      ),
    );
  });
});
