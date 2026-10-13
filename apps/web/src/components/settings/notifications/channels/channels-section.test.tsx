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
import { ChannelsSection } from "./channels-section";

const mutate = vi.fn();
const mutateAsync = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { channel?: string }) =>
      options?.channel ? `${key}|${options.channel}` : key,
  }),
}));

vi.mock(
  "@/hooks/mutations/notification-preferences/use-notification-preferences",
  () => ({
    useUpdateNotificationPreferences: () => ({
      mutate,
      mutateAsync,
      isPending: false,
      variables: undefined,
    }),
  }),
);

const basePreferences = {
  emailAddress: "mina@example.com",
  emailEnabled: false,
  ntfyEnabled: false,
  ntfyConfigured: false,
  ntfyServerUrl: null,
  ntfyTopic: null,
  ntfyTokenConfigured: false,
  maskedNtfyToken: null,
  gotifyEnabled: false,
  gotifyConfigured: true,
  gotifyServerUrl: "https://gotify.example.com/base",
  gotifyTokenConfigured: true,
  maskedGotifyToken: "••••abcd",
  webhookEnabled: false,
  webhookConfigured: false,
  webhookUrl: null,
  webhookSecretConfigured: false,
  maskedWebhookSecret: null,
  workspaces: [],
} as unknown as NotificationPreferences;

const channelRow = (channel: string) => {
  const row = document.querySelector<HTMLElement>(
    `[data-channel="${channel}"]`,
  );
  if (!row) throw new Error(`Missing ${channel} row`);
  return within(row);
};

describe("ChannelsSection", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mutate.mockReset();
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue(undefined);
  });

  it("turns email delivery on right away", () => {
    render(<ChannelsSection preferences={basePreferences} />);

    expect(screen.getByText("mina@example.com")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("switch", {
        name: "settings:notificationsPage.emailToggleLabel",
      }),
    );

    expect(mutate).toHaveBeenCalledWith({ emailEnabled: true });
  });

  it("disables the email switch without an account email", () => {
    render(
      <ChannelsSection
        preferences={{ ...basePreferences, emailAddress: null }}
      />,
    );

    expect(
      screen
        .getByRole("switch", {
          name: "settings:notificationsPage.emailToggleLabel",
        })
        .hasAttribute("data-disabled"),
    ).toBe(true);
  });

  it("connects ntfy from its inline panel and clears the token after saving", async () => {
    render(<ChannelsSection preferences={basePreferences} />);
    const ntfy = channelRow("ntfy");

    expect(
      ntfy.getByText("settings:notificationsPage.ntfyDescription"),
    ).toBeTruthy();
    fireEvent.click(ntfy.getByRole("button", { name: /connectChannel/ }));
    expect(
      ntfy.getByRole("button", { name: "common:actions.cancel" }),
    ).toBeTruthy();

    fireEvent.change(
      ntfy.getByLabelText("settings:notificationsPage.serverUrl"),
      {
        target: { value: "https://ntfy.sh" },
      },
    );
    fireEvent.change(ntfy.getByLabelText("settings:notificationsPage.topic"), {
      target: { value: "team" },
    });
    const token = ntfy.getByLabelText("settings:notificationsPage.token");
    fireEvent.change(token, { target: { value: "secret" } });

    await act(async () => {
      fireEvent.click(
        ntfy.getByRole("button", {
          name: "settings:notificationsPage.connectNtfy",
        }),
      );
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      ntfyEnabled: true,
      ntfyServerUrl: "https://ntfy.sh",
      ntfyTopic: "team",
      ntfyToken: "secret",
    });
    expect((token as HTMLInputElement).value).toBe("");
    expect(
      ntfy.queryByRole("button", {
        name: "settings:notificationsPage.disconnect",
      }),
    ).toBeNull();
  });

  it("keeps only one channel panel open", () => {
    render(<ChannelsSection preferences={basePreferences} />);

    fireEvent.click(
      channelRow("gotify").getByRole("button", { name: /configureChannel/ }),
    );
    expect(
      channelRow("gotify").getByLabelText(
        "settings:notificationsPage.gotifyTokenLabel",
      ),
    ).toBeTruthy();

    fireEvent.click(
      channelRow("webhook").getByRole("button", { name: /connectChannel/ }),
    );

    expect(
      channelRow("webhook").getByLabelText(
        "settings:notificationsPage.endpointUrl",
      ),
    ).toBeTruthy();
    expect(
      channelRow("gotify")
        .getByRole("button", { name: /configureChannel/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("shows a configured channel as paused with its host, and pauses or resumes it", () => {
    render(<ChannelsSection preferences={basePreferences} />);
    const gotify = channelRow("gotify");

    expect(
      gotify.getByText("settings:notificationsPage.statusPaused"),
    ).toBeTruthy();
    expect(gotify.getByText("gotify.example.com")).toBeTruthy();

    fireEvent.click(gotify.getByRole("button", { name: /configureChannel/ }));
    expect(
      gotify.getByText("settings:notificationsPage.gotifyTokenHintConfigured"),
    ).toBeTruthy();
    fireEvent.click(
      gotify.getByRole("switch", {
        name: "settings:notificationsPage.sendingLabel",
      }),
    );

    expect(mutate).toHaveBeenCalledWith({ gotifyEnabled: true });
  });

  it("asks before disconnecting a channel", async () => {
    render(<ChannelsSection preferences={basePreferences} />);
    const gotify = channelRow("gotify");

    fireEvent.click(gotify.getByRole("button", { name: /configureChannel/ }));
    fireEvent.click(
      gotify.getByRole("button", {
        name: "settings:notificationsPage.disconnect",
      }),
    );
    expect(mutateAsync).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "settings:notificationsPage.disconnect",
        }),
      );
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      gotifyEnabled: false,
      gotifyServerUrl: null,
      gotifyToken: null,
    });
  });
});
