import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TelegramIntegration } from "@/fetchers/telegram-integration/get-telegram-integration";
import { TelegramIntegrationSettings } from "./telegram-integration-settings";

const { state, createIntegration, updateIntegration } = vi.hoisted(() => ({
  state: { integration: null as TelegramIntegration },
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock(
  "@/hooks/queries/telegram-integration/use-get-telegram-integration",
  () => ({
    default: () => ({ data: state.integration, isLoading: false }),
  }),
);
vi.mock(
  "@/hooks/mutations/telegram-integration/use-telegram-integration",
  () => ({
    useCreateTelegramIntegration: () => ({
      mutateAsync: createIntegration,
      isPending: false,
    }),
    useUpdateTelegramIntegration: () => ({
      mutateAsync: updateIntegration,
      isPending: false,
    }),
    useDeleteTelegramIntegration: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  }),
);
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const token = `12345678:${"x".repeat(35)}`;

const connected: NonNullable<TelegramIntegration> = {
  id: "integration-1",
  projectId: "project-1",
  serverUrl: "https://tg.example.com",
  chatId: "chat",
  threadId: null,
  chatLabel: null,
  botTokenConfigured: true,
  maskedBotToken: "12345678:xxxx…xxxx",
  events: {
    taskCreated: true,
    taskStatusChanged: true,
    taskPriorityChanged: false,
    taskTitleChanged: false,
    taskDescriptionChanged: false,
    taskCommentCreated: true,
  },
  isActive: true,
  createdAt: "2026-09-26T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
};

function type(label: string, value: string) {
  fireEvent.change(
    screen.getByLabelText(`settings:telegramIntegration.${label}`),
    {
      target: { value },
    },
  );
}

function submit(name: "connect" | "saveChanges") {
  fireEvent.click(
    screen.getByRole("button", {
      name: `settings:telegramIntegration.${name}`,
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.integration = null;
});

describe("Telegram server URL", () => {
  it("rejects an invalid server URL and sends a valid one without the trailing slash", async () => {
    render(<TelegramIntegrationSettings projectId="project-1" />);
    type("botTokenLabel", token);
    type("chatIdLabel", "chat");
    type("serverUrlLabel", "tg.example.com");
    submit("connect");

    expect(
      await screen.findByText(
        "settings:telegramIntegration.validation.serverUrlInvalid",
      ),
    ).toBeInTheDocument();
    expect(createIntegration).not.toHaveBeenCalled();

    type("serverUrlLabel", "https://tg.example.com/proxy/");
    submit("connect");

    await waitFor(() =>
      expect(createIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        data: expect.objectContaining({
          botToken: token,
          serverUrl: "https://tg.example.com/proxy",
        }),
      }),
    );
  });

  it("asks for the bot token before switching a connected integration to another server", async () => {
    state.integration = connected;
    render(<TelegramIntegrationSettings projectId="project-1" />);
    type("serverUrlLabel", "https://other.example.com");
    submit("saveChanges");

    expect(
      await screen.findByText(
        "settings:telegramIntegration.validation.botTokenRequiredForServer",
      ),
    ).toBeInTheDocument();
    expect(updateIntegration).not.toHaveBeenCalled();
  });

  it("goes back to the official server when the field is cleared", async () => {
    state.integration = connected;
    render(<TelegramIntegrationSettings projectId="project-1" />);
    type("serverUrlLabel", "");
    type("botTokenLabel", token);
    submit("saveChanges");

    await waitFor(() =>
      expect(updateIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        json: expect.objectContaining({ botToken: token, serverUrl: null }),
      }),
    );
  });

  it("saves other changes without the token while the server stays the same", async () => {
    state.integration = connected;
    render(<TelegramIntegrationSettings projectId="project-1" />);
    type("chatIdLabel", "other-chat");
    submit("saveChanges");

    await waitFor(() =>
      expect(updateIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        json: expect.objectContaining({
          botToken: undefined,
          chatId: "other-chat",
          serverUrl: "https://tg.example.com",
        }),
      }),
    );
  });
});
