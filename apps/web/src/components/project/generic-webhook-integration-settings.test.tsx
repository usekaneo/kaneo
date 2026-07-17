import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GenericWebhookIntegrationSettings } from "./generic-webhook-integration-settings";

const createIntegration = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock(
  "@/hooks/queries/generic-webhook-integration/use-get-generic-webhook-integration",
  () => ({ default: () => ({ data: null, isLoading: false }) }),
);

vi.mock(
  "@/hooks/mutations/generic-webhook-integration/use-generic-webhook-integration",
  () => ({
    useCreateGenericWebhookIntegration: () => ({
      mutateAsync: createIntegration,
      isPending: false,
    }),
    useUpdateGenericWebhookIntegration: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useDeleteGenericWebhookIntegration: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  }),
);

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("GenericWebhookIntegrationSettings", () => {
  afterEach(cleanup);

  beforeEach(() => {
    createIntegration.mockReset();
    createIntegration.mockResolvedValue(undefined);
  });

  it("creates an opt-in project reminder webhook with its lead time", async () => {
    render(<GenericWebhookIntegrationSettings projectId="project-1" />);

    fireEvent.change(
      screen.getByLabelText("settings:genericWebhookIntegration.webhookLabel"),
      { target: { value: "https://example.com/hooks/kaneo" } },
    );
    fireEvent.click(
      screen.getByLabelText(
        "settings:genericWebhookIntegration.events.dueDateReminder",
      ),
    );
    fireEvent.change(
      screen.getByLabelText(
        "settings:genericWebhookIntegration.reminderLeadTimeLabel",
      ),
      { target: { value: "48" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:genericWebhookIntegration.connect",
      }),
    );

    await waitFor(() =>
      expect(createIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        data: expect.objectContaining({
          webhookUrl: "https://example.com/hooks/kaneo",
          dueDateReminderLeadTimeMinutes: 2880,
          events: expect.objectContaining({ dueDateReminder: true }),
        }),
      }),
    );
  });

  it("submits other webhook settings after an invalid reminder time is disabled", async () => {
    render(<GenericWebhookIntegrationSettings projectId="project-1" />);

    fireEvent.change(
      screen.getByLabelText("settings:genericWebhookIntegration.webhookLabel"),
      { target: { value: "https://example.com/hooks/kaneo" } },
    );
    fireEvent.click(
      screen.getByLabelText(
        "settings:genericWebhookIntegration.events.dueDateReminder",
      ),
    );
    fireEvent.change(
      screen.getByLabelText(
        "settings:genericWebhookIntegration.reminderLeadTimeLabel",
      ),
      { target: { value: "0" } },
    );
    fireEvent.click(
      screen.getByLabelText(
        "settings:genericWebhookIntegration.events.dueDateReminder",
      ),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:genericWebhookIntegration.connect",
      }),
    );

    await waitFor(() =>
      expect(createIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        data: expect.objectContaining({
          webhookUrl: "https://example.com/hooks/kaneo",
          events: expect.objectContaining({ dueDateReminder: false }),
        }),
      }),
    );
    expect(createIntegration.mock.calls[0]?.[0].data).not.toHaveProperty(
      "dueDateReminderLeadTimeMinutes",
    );
  });
});
