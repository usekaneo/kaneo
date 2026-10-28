import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TrelloConnectForm } from "@/components/import/connect-forms/trello-connect-form";
import { EMPTY_CONNECT_VALUES } from "@/components/import/connect-values";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const authorizeName = /settings:workspaceImport\.trello\.authorizeButton/;

describe("TrelloConnectForm", () => {
  it("uses the server's authorize link and asks only for the token", () => {
    render(
      <TrelloConnectForm
        values={EMPTY_CONNECT_VALUES}
        onChange={vi.fn()}
        error={null}
        trelloAuthorizeUrl="https://trello.com/1/authorize?key=server"
      />,
    );

    expect(
      screen.queryByLabelText("settings:workspaceImport.trello.apiKeyLabel"),
    ).toBeNull();
    const authorize = screen.getByRole("link", { name: authorizeName });
    expect(authorize).toHaveAttribute(
      "href",
      "https://trello.com/1/authorize?key=server",
    );
    expect(authorize).toHaveAttribute("target", "_blank");
    expect(authorize).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByLabelText("settings:workspaceImport.trello.tokenLabel"),
    ).toHaveAttribute("type", "password");
  });

  it("asks for an API key first when the server has none", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrelloConnectForm
        values={EMPTY_CONNECT_VALUES}
        onChange={onChange}
        error={null}
        trelloAuthorizeUrl={null}
      />,
    );

    expect(screen.getByRole("button", { name: authorizeName })).toBeDisabled();
    fireEvent.change(
      screen.getByLabelText("settings:workspaceImport.trello.apiKeyLabel"),
      { target: { value: "typed-key" } },
    );
    expect(onChange).toHaveBeenCalledWith({ apiKey: "typed-key" });

    rerender(
      <TrelloConnectForm
        values={{ ...EMPTY_CONNECT_VALUES, apiKey: "typed-key" }}
        onChange={onChange}
        error={null}
        trelloAuthorizeUrl={null}
      />,
    );
    expect(screen.getByRole("link", { name: authorizeName })).toHaveAttribute(
      "href",
      expect.stringContaining("key=typed-key"),
    );
  });

  it("shows the source's error under the token", () => {
    render(
      <TrelloConnectForm
        values={EMPTY_CONNECT_VALUES}
        onChange={vi.fn()}
        error="Trello rejected this token."
        trelloAuthorizeUrl="https://trello.com/1/authorize?key=server"
      />,
    );

    const token = screen.getByLabelText(
      "settings:workspaceImport.trello.tokenLabel",
    );
    expect(token).toHaveAttribute("aria-invalid", "true");
    expect(token).toHaveAccessibleDescription(
      expect.stringContaining("Trello rejected this token."),
    );
  });
});
