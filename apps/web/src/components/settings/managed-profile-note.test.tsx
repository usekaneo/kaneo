import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ManagedProfileNote } from "./managed-profile-note";

const m = vi.hoisted(() => ({
  config: undefined as
    | {
        customOAuthName: string | null;
        customOAuthAccountUrl: string | null;
      }
    | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { provider?: string }) =>
      options?.provider ? `${key}|${options.provider}` : key,
  }),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: m.config }),
}));

const ACCOUNT_URL = "https://keycloak.example.com/realms/acme/account";

describe("ManagedProfileNote", () => {
  afterEach(cleanup);

  beforeEach(() => {
    m.config = { customOAuthName: "Keycloak", customOAuthAccountUrl: null };
  });

  it("says the organization manages the field and offers no link without an account page", () => {
    render(<ManagedProfileNote />);

    expect(screen.getByText("settings:managedProfile.note")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to the provider's account page in a new tab", () => {
    m.config = {
      customOAuthName: "Keycloak",
      customOAuthAccountUrl: ACCOUNT_URL,
    };
    render(<ManagedProfileNote />);

    const link = screen.getByRole("link", {
      name: "settings:managedProfile.edit|Keycloak",
    });
    expect(link).toHaveAttribute("href", ACCOUNT_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("names the provider by its generic label when it has no name", () => {
    m.config = {
      customOAuthName: null,
      customOAuthAccountUrl: ACCOUNT_URL,
    };
    render(<ManagedProfileNote />);

    expect(
      screen.getByRole("link", {
        name: "settings:managedProfile.edit|auth:providers.sso",
      }),
    ).toBeTruthy();
  });
});
