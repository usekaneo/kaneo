import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { JiraConnectForm } from "@/components/import/connect-forms/jira-connect-form";
import { EMPTY_CONNECT_VALUES } from "@/components/import/connect-values";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("JiraConnectForm", () => {
  it("collects the site URL, email and token", () => {
    const onChange = vi.fn();
    render(
      <JiraConnectForm
        values={EMPTY_CONNECT_VALUES}
        onChange={onChange}
        error={null}
        trelloAuthorizeUrl={null}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("settings:workspaceImport.jira.urlLabel"),
      { target: { value: "https://acme.atlassian.net" } },
    );
    fireEvent.change(
      screen.getByLabelText("settings:workspaceImport.jira.emailLabel"),
      { target: { value: "ana@example.com" } },
    );
    const token = screen.getByLabelText(
      "settings:workspaceImport.jira.tokenLabel",
    );
    fireEvent.change(token, { target: { value: "jira-token" } });

    expect(onChange).toHaveBeenCalledWith({
      url: "https://acme.atlassian.net",
    });
    expect(onChange).toHaveBeenCalledWith({ email: "ana@example.com" });
    expect(onChange).toHaveBeenCalledWith({ token: "jira-token" });
    expect(token).toHaveAttribute("type", "password");
  });

  it("links to the Atlassian API tokens page", () => {
    render(
      <JiraConnectForm
        values={EMPTY_CONNECT_VALUES}
        onChange={vi.fn()}
        error={null}
        trelloAuthorizeUrl={null}
      />,
    );

    const link = screen.getByRole("link", {
      name: /settings:workspaceImport\.jira\.openSettings/,
    });
    expect(link).toHaveAttribute(
      "href",
      "https://id.atlassian.com/manage-profile/security/api-tokens",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });
});
