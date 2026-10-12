import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { NotifyMeSection } from "./notify-me-section";
import { LEAD_TIME_SAVE_DELAY_MS } from "./use-event-preferences-autosave";

const updatePreferences = vi.fn();
const hookOptions = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock(
  "@/hooks/mutations/notification-preferences/use-notification-preferences",
  () => ({
    useUpdateNotificationPreferences: (options?: { silent?: boolean }) => {
      hookOptions(options);
      return { mutateAsync: updatePreferences, isPending: false };
    },
  }),
);

const preferences = {
  emailAddress: "mina@example.com",
  emailEnabled: false,
  taskAssignmentEnabled: true,
  taskCommentEnabled: true,
  taskStatusChangeEnabled: true,
  dueDateReminderEnabled: true,
  dueDateReminderLeadTimeMinutes: 1440,
  workspaces: [],
} as unknown as NotificationPreferences;

const leadTimeInput = () =>
  screen.getByLabelText("settings:notificationsPage.reminderLeadTimeLabel");

describe("NotifyMeSection", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    updatePreferences.mockReset();
    updatePreferences.mockResolvedValue(undefined);
    hookOptions.mockReset();
  });

  it("saves a switch immediately and quietly, without a save button", () => {
    render(<NotifyMeSection preferences={preferences} />);

    fireEvent.click(
      screen.getByRole("switch", {
        name: "settings:notificationsPage.eventTaskAssignments",
      }),
    );

    expect(updatePreferences).toHaveBeenCalledWith({
      taskAssignmentEnabled: false,
    });
    expect(hookOptions).toHaveBeenCalledWith({ silent: true });
    expect(screen.getByText("settings:shared.autosave")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "settings:notificationsPage.saveEventPreferences",
      }),
    ).toBeNull();
  });

  it("restores a switch when saving it fails", async () => {
    updatePreferences.mockRejectedValueOnce(new Error("nope"));
    render(<NotifyMeSection preferences={preferences} />);
    const toggle = screen.getByRole("switch", {
      name: "settings:notificationsPage.eventStatusChanges",
    });

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("saves a valid lead time after a short pause", () => {
    vi.useFakeTimers();
    render(<NotifyMeSection preferences={preferences} />);

    fireEvent.change(leadTimeInput(), { target: { value: "2" } });
    expect(updatePreferences).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(LEAD_TIME_SAVE_DELAY_MS);
    });

    expect(updatePreferences).toHaveBeenCalledTimes(1);
    expect(updatePreferences).toHaveBeenCalledWith({
      dueDateReminderLeadTimeMinutes: 2880,
    });
  });

  it("shows the inline error and does not save a cleared lead time", () => {
    vi.useFakeTimers();
    render(<NotifyMeSection preferences={preferences} />);

    fireEvent.change(leadTimeInput(), { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(LEAD_TIME_SAVE_DELAY_MS * 2);
    });

    expect(
      screen.getByText("settings:notificationsPage.reminderLeadTimeInvalid"),
    ).toBeTruthy();
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it("turns reminders off without validating the retained lead time", () => {
    vi.useFakeTimers();
    render(<NotifyMeSection preferences={preferences} />);

    fireEvent.change(leadTimeInput(), { target: { value: "0" } });
    fireEvent.click(
      screen.getByRole("switch", {
        name: "settings:notificationsPage.eventDueDateReminders",
      }),
    );
    act(() => {
      vi.advanceTimersByTime(LEAD_TIME_SAVE_DELAY_MS * 2);
    });

    expect(updatePreferences).toHaveBeenCalledTimes(1);
    expect(updatePreferences).toHaveBeenCalledWith({
      dueDateReminderEnabled: false,
    });
    expect(
      screen.queryByText("settings:notificationsPage.reminderLeadTimeInvalid"),
    ).toBeNull();
    expect(leadTimeInput()).toHaveProperty("disabled", true);
  });

  it("saves a pending lead time when the page closes", () => {
    vi.useFakeTimers();
    const { unmount } = render(<NotifyMeSection preferences={preferences} />);

    fireEvent.change(leadTimeInput(), { target: { value: "3" } });
    unmount();

    expect(updatePreferences).toHaveBeenCalledWith({
      dueDateReminderLeadTimeMinutes: 4320,
    });
  });
});
