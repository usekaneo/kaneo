import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvitationSignedOut } from "./invitation-signed-out";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { workspaceName?: string }) =>
      options?.workspaceName ? `${key}:${options.workspaceName}` : key,
  }),
  Trans: ({
    i18nKey,
    values,
  }: {
    i18nKey: string;
    values?: Record<string, string>;
  }) => (
    <span>
      {i18nKey}
      {values ? `:${Object.values(values).join(",")}` : ""}
    </span>
  ),
}));

describe("InvitationSignedOut", () => {
  afterEach(() => {
    cleanup();
  });

  it("primary CTA creates account and secondary signs in", () => {
    const onCreateAccount = vi.fn();
    const onSignIn = vi.fn();

    render(
      <InvitationSignedOut
        workspaceName="Acme"
        inviterName="Ada"
        email="guest@example.com"
        onCreateAccount={onCreateAccount}
        onSignIn={onSignIn}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /auth:invitation.createAccount/ }),
    );
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "auth:invitation.signIn" }),
    );
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("does not use sign-in as the primary CTA label", () => {
    render(
      <InvitationSignedOut
        workspaceName="Acme"
        inviterName="Ada"
        email="guest@example.com"
        onCreateAccount={vi.fn()}
        onSignIn={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("auth:invitation.createAccount");
    expect(buttons[0]).not.toHaveTextContent("auth:invitation.signIn");
  });
});
