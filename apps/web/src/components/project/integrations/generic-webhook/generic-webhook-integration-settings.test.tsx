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
import { toGenericWebhookEvents } from "./generic-webhook-events";
import { GenericWebhookIntegrationSettings } from "./generic-webhook-integration-settings";

const mocks = vi.hoisted(() => ({
  integration: null as unknown,
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock(
  "@/hooks/queries/generic-webhook-integration/use-get-generic-webhook-integration",
  () => ({
    default: () => ({ data: mocks.integration, isLoading: false }),
  }),
);

vi.mock(
  "@/hooks/mutations/generic-webhook-integration/use-generic-webhook-integration",
  () => ({
    useCreateGenericWebhookIntegration: () => ({
      mutateAsync: mocks.createIntegration,
      isPending: false,
    }),
    useUpdateGenericWebhookIntegration: () => ({
      mutateAsync: mocks.updateIntegration,
      isPending: false,
    }),
    useDeleteGenericWebhookIntegration: () => ({
      mutateAsync: mocks.deleteIntegration,
      isPending: false,
    }),
  }),
);

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const connectedIntegration = {
  id: "integration-1",
  projectId: "project-1",
  webhookConfigured: true,
  maskedWebhookUrl: "http…kaneo",
  secretConfigured: true,
  maskedSecret: "shh…cret",
  events: toGenericWebhookEvents(),
  dueDateReminderLeadTimeMinutes: 1440,
  isActive: true,
  createdAt: "",
  updatedAt: "",
};

function eventCheckbox(event: string) {
  return screen.getByRole("checkbox", {
    name: `settings:genericWebhookIntegration.events.${event}`,
  });
}

function leadTimeInput() {
  return screen.getByLabelText(
    "settings:genericWebhookIntegration.reminderLeadTimeLabel",
  );
}

function setEndpoint(value: string) {
  fireEvent.change(
    screen.getByLabelText("settings:genericWebhookIntegration.webhookLabel"),
    { target: { value } },
  );
}

describe("GenericWebhookIntegrationSettings", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.integration = null;
    mocks.createIntegration.mockReset().mockResolvedValue(undefined);
    mocks.updateIntegration.mockReset().mockResolvedValue(undefined);
    mocks.deleteIntegration.mockReset().mockResolvedValue(undefined);
  });

  it("lists all twelve events and shows reminder timing only when reminders are on", () => {
    render(<GenericWebhookIntegrationSettings projectId="project-1" />);

    expect(
      within(
        screen.getByRole("group", {
          name: "settings:genericWebhookIntegration.eventsTitle",
        }),
      ).getAllByRole("checkbox"),
    ).toHaveLength(12);
    expect(
      screen.queryByLabelText(
        "settings:genericWebhookIntegration.reminderLeadTimeLabel",
      ),
    ).toBeNull();

    fireEvent.click(eventCheckbox("dueDateReminder"));

    expect(leadTimeInput()).toHaveValue(24);
  });

  it("creates an opt-in project reminder webhook with its lead time", async () => {
    render(<GenericWebhookIntegrationSettings projectId="project-1" />);

    setEndpoint("https://example.com/hooks/kaneo");
    fireEvent.click(eventCheckbox("dueDateReminder"));
    fireEvent.change(leadTimeInput(), { target: { value: "48" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:genericWebhookIntegration.connect",
      }),
    );

    await waitFor(() =>
      expect(mocks.createIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        data: expect.objectContaining({
          webhookUrl: "https://example.com/hooks/kaneo",
          dueDateReminderLeadTimeMinutes: 2880,
          events: expect.objectContaining({
            dueDateReminder: true,
            taskDeleted: false,
            taskMoved: false,
            taskDueDateChanged: false,
            taskAssigneeChanged: false,
            taskUnassigned: false,
          }),
        }),
      }),
    );
  });

  it("creates a webhook with the opt-in task lifecycle events enabled", async () => {
    render(<GenericWebhookIntegrationSettings projectId="project-1" />);

    setEndpoint("https://example.com/hooks/kaneo");
    for (const event of [
      "taskDeleted",
      "taskMoved",
      "taskDueDateChanged",
      "taskAssigneeChanged",
      "taskUnassigned",
    ]) {
      fireEvent.click(eventCheckbox(event));
    }
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:genericWebhookIntegration.connect",
      }),
    );

    await waitFor(() =>
      expect(mocks.createIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        data: expect.objectContaining({
          events: expect.objectContaining({
            taskDeleted: true,
            taskMoved: true,
            taskDueDateChanged: true,
            taskAssigneeChanged: true,
            taskUnassigned: true,
          }),
        }),
      }),
    );
  });

  it("shows an inline error for an out of range reminder time", async () => {
    render(<GenericWebhookIntegrationSettings projectId="project-1" />);

    setEndpoint("https://example.com/hooks/kaneo");
    fireEvent.click(eventCheckbox("dueDateReminder"));
    fireEvent.change(leadTimeInput(), { target: { value: "721" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:genericWebhookIntegration.connect",
      }),
    );

    expect(
      await screen.findByText(
        "settings:genericWebhookIntegration.validation.leadTimeRange",
      ),
    ).toBeTruthy();
    expect(mocks.createIntegration).not.toHaveBeenCalled();
  });

  it("submits other webhook settings after an invalid reminder time is disabled", async () => {
    render(<GenericWebhookIntegrationSettings projectId="project-1" />);

    setEndpoint("https://example.com/hooks/kaneo");
    fireEvent.click(eventCheckbox("dueDateReminder"));
    fireEvent.change(leadTimeInput(), { target: { value: "0" } });
    fireEvent.click(eventCheckbox("dueDateReminder"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:genericWebhookIntegration.connect",
      }),
    );

    await waitFor(() =>
      expect(mocks.createIntegration).toHaveBeenCalledWith({
        projectId: "project-1",
        data: expect.objectContaining({
          webhookUrl: "https://example.com/hooks/kaneo",
          events: expect.objectContaining({ dueDateReminder: false }),
        }),
      }),
    );
    expect(mocks.createIntegration.mock.calls[0]?.[0].data).not.toHaveProperty(
      "dueDateReminderLeadTimeMinutes",
    );
  });

  it("keeps the saved endpoint when the field is left empty", async () => {
    mocks.integration = connectedIntegration;
    render(<GenericWebhookIntegrationSettings projectId="project-1" />);

    expect(
      screen.getByLabelText("settings:genericWebhookIntegration.webhookLabel"),
    ).toHaveAttribute(
      "placeholder",
      "settings:chatIntegrations.savedUrlPlaceholder",
    );
    expect(
      screen.getByText(
        "settings:genericWebhookIntegration.secretHintConfigured",
      ),
    ).toBeTruthy();
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
          secret: undefined,
          events: toGenericWebhookEvents(),
        },
      }),
    );
  });

  it("disconnects only after confirmation", async () => {
    mocks.integration = connectedIntegration;
    render(<GenericWebhookIntegrationSettings projectId="project-1" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:chatIntegrations.disconnect",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(mocks.deleteIntegration).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:chatIntegrations.disconnect",
      }),
    );

    await waitFor(() =>
      expect(mocks.deleteIntegration).toHaveBeenCalledWith("project-1"),
    );
  });
});
