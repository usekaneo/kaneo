import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DeliveryFooter } from "./delivery-footer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderFooter(
  props: Partial<Parameters<typeof DeliveryFooter>[0]> = {},
) {
  return render(
    <form>
      <DeliveryFooter
        busy={false}
        connectLabel="Connect Slack"
        connected
        disconnectDescription="Kaneo stops posting to Slack."
        disconnectTitle="Disconnect Slack?"
        disconnecting={false}
        onDisconnect={vi.fn().mockResolvedValue(true)}
        {...props}
      />
    </form>,
  );
}

describe("DeliveryFooter", () => {
  afterEach(cleanup);

  it("only offers the connect action before setup", () => {
    renderFooter({ connected: false });

    expect(
      screen.getByRole("button", { name: "Connect Slack" }),
    ).toHaveAttribute("type", "submit");
    expect(
      screen.queryByRole("button", {
        name: "settings:chatIntegrations.disconnect",
      }),
    ).toBeNull();
  });

  it("asks for confirmation before disconnecting", async () => {
    const onDisconnect = vi.fn().mockResolvedValue(true);
    renderFooter({ onDisconnect });

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:chatIntegrations.disconnect",
      }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Disconnect Slack?")).toBeTruthy();
    expect(onDisconnect).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:chatIntegrations.disconnect",
      }),
    );

    await waitFor(() => expect(onDisconnect).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("keeps the confirmation open when disconnecting fails", async () => {
    const onDisconnect = vi.fn().mockResolvedValue(false);
    renderFooter({ onDisconnect });

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:chatIntegrations.disconnect",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:chatIntegrations.disconnect",
      }),
    );

    await waitFor(() => expect(onDisconnect).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
