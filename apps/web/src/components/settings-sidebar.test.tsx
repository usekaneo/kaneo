import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsSidebar, {
  SettingsSidebarProvider,
} from "@/components/SettingsSidebar";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet } from "@/components/ui/sheet";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

function renderSettings({ menuOpen }: { menuOpen: boolean }) {
  return render(
    <SettingsSidebarProvider
      workspaceId="workspace-1"
      menuOpen={menuOpen}
      setMenuOpen={vi.fn()}
    >
      <div className="flex">
        <SettingsSidebar>
          <span>Account nav</span>
        </SettingsSidebar>
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            </AlertDialogHeader>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SettingsSidebarProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("SettingsSidebar", () => {
  it("renders only the desktop sidebar while the mobile menu is closed", () => {
    renderSettings({ menuOpen: false });

    expect(screen.getAllByText("Account nav")).toHaveLength(1);
  });

  it("renders the nav in the mobile sheet when the menu is open", () => {
    renderSettings({ menuOpen: true });

    expect(screen.getAllByText("Account nav")).toHaveLength(2);
  });

  it("keeps page dialogs out of the settings sheet's dialog tree", () => {
    renderSettings({ menuOpen: false });

    expect(screen.getByText("Delete your account?")).toBeTruthy();
    expect(
      document.querySelector('[data-slot="alert-dialog-backdrop"]'),
    ).not.toBeNull();
    expect(
      document
        .querySelector('[data-slot="alert-dialog-popup"]')
        ?.hasAttribute("data-nested"),
    ).toBe(false);
  });

  it("treats a dialog inside the sheet's root as nested, which is what the old layout did", () => {
    render(
      <Sheet open={false}>
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nested</AlertDialogTitle>
            </AlertDialogHeader>
          </AlertDialogContent>
        </AlertDialog>
      </Sheet>,
    );

    expect(
      document
        .querySelector('[data-slot="alert-dialog-popup"]')
        ?.hasAttribute("data-nested"),
    ).toBe(true);
  });
});
