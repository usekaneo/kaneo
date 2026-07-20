import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthToggle } from "./toggle";

const configState: {
  disableRegistration?: boolean;
  disablePasswordRegistration?: boolean;
} = {};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({
    data: configState,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    className,
  }: {
    to: string;
    search?: Record<string, string | undefined>;
    children: React.ReactNode;
    className?: string;
  }) => {
    const params = new URLSearchParams();
    if (search) {
      for (const [key, value] of Object.entries(search)) {
        if (value !== undefined) {
          params.set(key, value);
        }
      }
    }
    const query = params.toString();
    return (
      <a href={query ? `${to}?${query}` : to} className={className}>
        {children}
      </a>
    );
  },
}));

describe("AuthToggle", () => {
  afterEach(() => {
    cleanup();
    configState.disableRegistration = undefined;
    configState.disablePasswordRegistration = undefined;
  });

  it("hides when registration is disabled and there is no invitation", () => {
    configState.disableRegistration = true;

    const { container } = render(
      <AuthToggle
        message="Don't have an account?"
        linkText="Create account"
        linkTo="/auth/sign-up"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows when registration is disabled but invitationId is present", () => {
    configState.disableRegistration = true;

    render(
      <AuthToggle
        message="Don't have an account?"
        linkText="Create account"
        linkTo="/auth/sign-up"
        search={{ invitationId: "inv-1", email: "a@example.com" }}
      />,
    );

    const link = screen.getByRole("link", { name: "Create account" });
    expect(link).toHaveAttribute(
      "href",
      "/auth/sign-up?invitationId=inv-1&email=a%40example.com",
    );
  });

  it("shows when registration is open", () => {
    configState.disableRegistration = false;

    render(
      <AuthToggle
        message="Don't have an account?"
        linkText="Create account"
        linkTo="/auth/sign-up"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/auth/sign-up");
  });

  it("hides when password registration is disabled without invitation", () => {
    configState.disablePasswordRegistration = true;

    const { container } = render(
      <AuthToggle
        message="Already have an account?"
        linkText="Sign in"
        linkTo="/auth/sign-in"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
