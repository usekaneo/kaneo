import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { LanguageRow } from "./language-row";

const m = vi.hoisted(() => ({
  managedFields: [] as string[],
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
vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => ({ locale: "de-DE", setLocale: vi.fn() }),
}));
vi.mock("@/hooks/queries/user/use-managed-profile-fields", () => ({
  default: () => m.managedFields,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: m.config }),
}));

const ACCOUNT_URL = "https://keycloak.example.com/realms/acme/account";

function languagePicker() {
  return screen.getByRole("combobox", {
    name: "settings:preferencesPage.language",
  });
}

describe("LanguageRow", () => {
  afterEach(cleanup);

  beforeEach(() => {
    m.managedFields = [];
    m.config = { customOAuthName: "Keycloak", customOAuthAccountUrl: null };
  });

  it("lets people pick a language when it is not managed", () => {
    m.managedFields = ["name", "image"];
    render(<LanguageRow />);

    expect(languagePicker()).not.toHaveAttribute("data-disabled");
    expect(screen.queryByText("settings:managedProfile.note")).toBeNull();
  });

  it("disables the picker with a hint when the provider manages the language", () => {
    m.managedFields = ["locale"];
    render(<LanguageRow />);

    expect(languagePicker()).toHaveAttribute("data-disabled");
    expect(screen.getByText("settings:managedProfile.note")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to the provider's account page when one is configured", () => {
    m.managedFields = ["locale"];
    m.config = {
      customOAuthName: "Keycloak",
      customOAuthAccountUrl: ACCOUNT_URL,
    };
    render(<LanguageRow />);

    expect(
      screen.getByRole("link", {
        name: "settings:managedProfile.edit|Keycloak",
      }),
    ).toHaveAttribute("href", ACCOUNT_URL);
  });
});
