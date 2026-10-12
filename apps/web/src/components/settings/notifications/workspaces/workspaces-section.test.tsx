import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
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
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { WorkspacesSection } from "./workspaces-section";

const upsertRule = vi.fn();
const deleteRule = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { workspaceName?: string }) =>
      options?.workspaceName ? `${key}|${options.workspaceName}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/hooks/queries/workspace/use-get-workspaces", () => ({
  default: () => ({
    data: [
      { id: "w1", name: "Northwind" },
      { id: "w2", name: "acme" },
    ],
  }),
}));

vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "p1", name: "Roadmap" },
      { id: "p2", name: "Support" },
    ],
    isLoading: false,
  }),
}));

vi.mock(
  "@/hooks/mutations/notification-preferences/use-notification-preferences",
  () => ({
    useUpsertNotificationWorkspaceRule: () => ({
      mutateAsync: upsertRule,
      isPending: false,
    }),
    useDeleteNotificationWorkspaceRule: () => ({
      mutateAsync: deleteRule,
      isPending: false,
    }),
  }),
);

const preferences = {
  emailAddress: "mina@example.com",
  emailEnabled: true,
  gotifyConfigured: true,
  gotifyEnabled: false,
  ntfyConfigured: false,
  ntfyEnabled: false,
  webhookConfigured: false,
  webhookEnabled: false,
  workspaces: [
    {
      id: "r1",
      workspaceId: "w1",
      workspaceName: "Northwind",
      isActive: true,
      emailEnabled: true,
      gotifyEnabled: false,
      ntfyEnabled: false,
      webhookEnabled: false,
      projectMode: "all",
      selectedProjectIds: [],
      createdAt: "",
      updatedAt: "",
    },
  ],
} as unknown as NotificationPreferences;

describe("WorkspacesSection", () => {
  afterEach(cleanup);

  beforeEach(() => {
    upsertRule.mockReset();
    upsertRule.mockResolvedValue(undefined);
    deleteRule.mockReset();
    deleteRule.mockResolvedValue(undefined);
  });

  it("summarizes each workspace and offers configure or set up", () => {
    render(<WorkspacesSection preferences={preferences} />);

    expect(screen.getByText("N")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(
      screen.getByText("settings:notificationsPage.statusSending"),
    ).toBeTruthy();
    expect(
      screen.getByText("settings:notificationsPage.onlyInKaneo"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "settings:notificationsPage.configureWorkspace|Northwind",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "settings:notificationsPage.setUpWorkspace|acme",
      }),
    ).toBeTruthy();
  });

  it("sets up a rule with only available channels and selected projects", async () => {
    render(<WorkspacesSection preferences={preferences} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:notificationsPage.setUpWorkspace|acme",
      }),
    );
    const dialog = within(screen.getByRole("dialog"));

    expect(
      dialog.getByText("settings:notificationsPage.ruleDialogTitle|acme"),
    ).toBeTruthy();
    expect(
      dialog.queryByRole("button", {
        name: "settings:notificationsPage.stopSending",
      }),
    ).toBeNull();
    expect(
      dialog
        .getByRole("switch", { name: "settings:notificationsPage.gotifyTitle" })
        .hasAttribute("data-disabled"),
    ).toBe(true);
    expect(
      dialog.getByText("settings:notificationsPage.statusPaused"),
    ).toBeTruthy();
    expect(
      dialog.getAllByText("settings:notificationsPage.channelNotConnected"),
    ).toHaveLength(2);

    fireEvent.click(
      dialog.getByRole("button", {
        name: "settings:notificationsPage.someProjects",
      }),
    );
    fireEvent.click(dialog.getByRole("checkbox", { name: "Support" }));

    await act(async () => {
      fireEvent.click(
        dialog.getByRole("button", { name: "settings:notificationsPage.save" }),
      );
    });

    expect(upsertRule).toHaveBeenCalledWith({
      workspaceId: "w2",
      json: {
        isActive: true,
        emailEnabled: true,
        gotifyEnabled: false,
        ntfyEnabled: false,
        webhookEnabled: false,
        projectMode: "selected",
        selectedProjectIds: ["p2"],
      },
    });
  });

  it("asks before it stops sending from a workspace", async () => {
    render(<WorkspacesSection preferences={preferences} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:notificationsPage.configureWorkspace|Northwind",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "settings:notificationsPage.stopSending",
      }),
    );
    expect(deleteRule).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "settings:notificationsPage.stopSending",
        }),
      );
    });

    expect(deleteRule).toHaveBeenCalledWith("w1");
  });
});
