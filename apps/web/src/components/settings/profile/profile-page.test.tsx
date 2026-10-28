import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ProfilePage } from "./profile-page";

const m = vi.hoisted(() => ({
  managedFields: [] as string[],
  config: undefined as
    | {
        customOAuthName: string | null;
        customOAuthAccountUrl: string | null;
      }
    | undefined,
  user: {
    id: "user-1",
    name: "Jane Doe",
    email: "jane@example.com",
    image: null as string | null,
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { provider?: string }) =>
      options?.provider ? `${key}|${options.provider}` : key,
  }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: m.user, refetchUser: vi.fn() }),
}));
vi.mock("@/hooks/queries/user/use-managed-profile-fields", () => ({
  default: () => m.managedFields,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: m.config }),
}));
vi.mock("@/hooks/mutations/use-update-user-profile", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/use-update-user-avatar", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/use-remove-user-avatar", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/components/settings/profile/delete-account-section", () => ({
  DeleteAccountSection: () => null,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const ACCOUNT_URL = "https://keycloak.example.com/realms/acme/account";

function nameInput() {
  return screen.getByRole("textbox", {
    name: "settings:informationPage.fullName",
  });
}

function avatarButton(action: "upload" | "remove") {
  return screen.queryByRole("button", {
    name: `settings:informationPage.avatar.${action}`,
  });
}

describe("ProfilePage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    m.managedFields = [];
    m.config = { customOAuthName: "Keycloak", customOAuthAccountUrl: null };
    m.user = {
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      image: "https://id.example.com/jane.png",
    };
  });

  it("keeps the name and picture editable when nothing is managed", () => {
    render(<ProfilePage />);

    expect(nameInput()).toBeEnabled();
    expect(avatarButton("upload")).toBeTruthy();
    expect(avatarButton("remove")).toBeTruthy();
    expect(
      screen.getByText("settings:informationPage.avatar.hint"),
    ).toBeTruthy();
    expect(screen.queryByText("settings:managedProfile.note")).toBeNull();
  });

  it("shows the managed name and picture read-only with a hint", () => {
    m.managedFields = ["name", "image"];
    render(<ProfilePage />);

    expect(nameInput()).toBeDisabled();
    expect(nameInput()).toHaveValue("Jane Doe");
    expect(avatarButton("upload")).toBeNull();
    expect(avatarButton("remove")).toBeNull();
    expect(
      screen.queryByText("settings:informationPage.avatar.hint"),
    ).toBeNull();
    expect(screen.getAllByText("settings:managedProfile.note")).toHaveLength(2);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links each managed field to the provider's account page", () => {
    m.managedFields = ["name", "image"];
    m.config = {
      customOAuthName: "Keycloak",
      customOAuthAccountUrl: ACCOUNT_URL,
    };
    render(<ProfilePage />);

    const links = screen.getAllByRole("link", {
      name: "settings:managedProfile.edit|Keycloak",
    });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", ACCOUNT_URL);
    }
  });

  it("still lets people remove a picture they uploaded in Kaneo", () => {
    m.managedFields = ["image"];
    m.user.image = "/api/user/avatar/avatar-1";
    render(<ProfilePage />);

    expect(avatarButton("remove")).toBeTruthy();
    expect(avatarButton("upload")).toBeNull();
    expect(nameInput()).toBeEnabled();
  });
});
