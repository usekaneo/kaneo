import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationPreferencesSettings } from "./notification-preferences-settings";

const updatePreferences = vi.fn();
const preferences = {
  emailAddress: "mina@example.com",
  emailEnabled: false,
  ntfyEnabled: false,
  ntfyConfigured: false,
  ntfyServerUrl: null,
  ntfyTopic: null,
  ntfyTokenConfigured: false,
  maskedNtfyToken: null,
  gotifyEnabled: false,
  gotifyConfigured: false,
  gotifyServerUrl: null,
  gotifyTokenConfigured: false,
  maskedGotifyToken: null,
  webhookEnabled: false,
  webhookConfigured: false,
  webhookUrl: null,
  webhookSecretConfigured: false,
  maskedWebhookSecret: null,
  taskAssignmentEnabled: true,
  taskCommentEnabled: true,
  taskStatusChangeEnabled: true,
  dueDateReminderEnabled: true,
  dueDateReminderLeadTimeMinutes: 1440,
  workspaces: [],
  createdAt: null,
  updatedAt: null,
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock(
  "@/hooks/queries/notification-preferences/use-get-notification-preferences",
  () => ({
    default: () => ({
      data: preferences,
      isLoading: false,
    }),
  }),
);

vi.mock("@/hooks/queries/workspace/use-get-workspaces", () => ({
  default: () => ({ data: [] }),
}));

vi.mock(
  "@/hooks/mutations/notification-preferences/use-notification-preferences",
  () => ({
    useUpdateNotificationPreferences: () => ({
      mutateAsync: updatePreferences,
      isPending: false,
    }),
    useUpsertNotificationWorkspaceRule: () => ({ mutateAsync: vi.fn() }),
    useDeleteNotificationWorkspaceRule: () => ({ mutateAsync: vi.fn() }),
  }),
);

describe("NotificationPreferencesSettings", () => {
  afterEach(cleanup);

  beforeEach(() => {
    updatePreferences.mockReset();
    updatePreferences.mockResolvedValue(undefined);
  });

  it("saves event preferences and a configurable reminder lead time", async () => {
    render(<NotificationPreferencesSettings />);

    fireEvent.click(
      screen.getByLabelText("settings:notificationsPage.eventTaskAssignments"),
    );
    fireEvent.change(
      screen.getByLabelText("settings:notificationsPage.reminderLeadTimeLabel"),
      { target: { value: "2" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:notificationsPage.saveEventPreferences",
      }),
    );

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        taskAssignmentEnabled: false,
        taskCommentEnabled: true,
        taskStatusChangeEnabled: true,
        dueDateReminderEnabled: true,
        dueDateReminderLeadTimeMinutes: 2880,
      }),
    );
  });

  it("blocks saving a cleared reminder lead time", () => {
    render(<NotificationPreferencesSettings />);

    fireEvent.change(
      screen.getByLabelText("settings:notificationsPage.reminderLeadTimeLabel"),
      { target: { value: "" } },
    );

    expect(
      screen.getByText("settings:notificationsPage.reminderLeadTimeInvalid"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "settings:notificationsPage.saveEventPreferences",
      }),
    ).toHaveProperty("disabled", true);
  });

  it("saves disabled reminders without validating their retained lead time", async () => {
    render(<NotificationPreferencesSettings />);

    fireEvent.change(
      screen.getByLabelText("settings:notificationsPage.reminderLeadTimeLabel"),
      { target: { value: "0" } },
    );
    fireEvent.click(
      screen.getByLabelText("settings:notificationsPage.eventDueDateReminders"),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:notificationsPage.saveEventPreferences",
      }),
    );

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        taskAssignmentEnabled: true,
        taskCommentEnabled: true,
        taskStatusChangeEnabled: true,
        dueDateReminderEnabled: false,
      }),
    );
  });
});
