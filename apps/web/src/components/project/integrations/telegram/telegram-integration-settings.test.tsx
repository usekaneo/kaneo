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
import { toChatEvents } from "@/components/project/integrations/chat-webhook/chat-events";
import { TelegramIntegrationSettings } from "./telegram-integration-settings";

const mocks = vi.hoisted(() => ({
  query: {
    data: null as unknown,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
    isRefetching: false,
  },
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock(
  "@/hooks/queries/telegram-integration/use-get-telegram-integration",
  () => ({ default: () => mocks.query }),
);

vi.mock(
  "@/hooks/mutations/telegram-integration/use-telegram-integration",
  () => ({
    useCreateTelegramIntegration: () => ({
      mutateAsync: mocks.createIntegration,
      isPending: false,
    }),
    useUpdateTelegramIntegration: () => ({
      mutateAsync: mocks.updateIntegration,
      isPending: false,
    }),
    useDeleteTelegramIntegration: () => ({
      mutateAsync: mocks.deleteIntegration,
      isPending: false,
    }),
  }),
);

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("TelegramIntegrationSettings", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.query = {
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isRefetching: false,
    };
    mocks.createIntegration.mockReset().mockResolvedValue(undefined);
    mocks.updateIntegration.mockReset().mockResolvedValue(undefined);
    mocks.deleteIntegration.mockReset().mockResolvedValue(undefined);
  });

  it("shows a retryable error when the settings fail to load", () => {
    mocks.query.error = new Error("Network down");
    render(<TelegramIntegrationSettings projectId="project-1" />);

    expect(
      screen.getByText("settings:telegramIntegration.loadError"),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:chatIntegrations.retry" }),
    );
    expect(mocks.query.refetch).toHaveBeenCalledTimes(1);
  });

  it("requires a chat ID before connecting", async () => {
    render(<TelegramIntegrationSettings projectId="project-1" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:telegramIntegration.connect",
      }),
    );

    expect(
      await screen.findByText(
        "settings:telegramIntegration.validation.chatIdRequired",
      ),
    ).toBeTruthy();
    expect(mocks.createIntegration).not.toHaveBeenCalled();
  });

  it("keeps the saved bot token when the field is left empty", async () => {
    mocks.query.data = {
      id: "integration-1",
      projectId: "project-1",
      chatId: "-1001234567890",
      threadId: 7,
      chatLabel: "Engineering",
      botTokenConfigured: true,
      maskedBotToken: "1234:…abcd",
      events: toChatEvents(),
      isActive: true,
      createdAt: "",
      updatedAt: "",
    };
    render(<TelegramIntegrationSettings projectId="project-1" />);

    expect(
      screen.getByLabelText("settings:telegramIntegration.botTokenLabel"),
    ).toHaveAttribute(
      "placeholder",
      "settings:telegramIntegration.botTokenSavedPlaceholder",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:chatIntegrations.saveChanges",
      }),
    );

    await waitFor(() =>
      expect(mocks.updateIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        json: {
          botToken: undefined,
          chatId: "-1001234567890",
          threadId: 7,
          chatLabel: "Engineering",
          events: toChatEvents(),
        },
      }),
    );
  });
});
