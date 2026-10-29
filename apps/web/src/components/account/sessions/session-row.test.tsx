import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ActiveSession } from "@/fetchers/user/session-types";
import { SessionRow } from "./session-row";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/format", () => ({
  formatRelativeTime: () => "recently",
  formatDateMedium: () => "Oct 27, 2026",
}));

const session: ActiveSession = {
  id: "session-1",
  browser: "Firefox",
  os: "Linux",
  ipAddress: null,
  current: false,
  createdAt: "2026-10-27T08:00:00.000Z",
  lastActiveAt: "2026-10-27T08:00:00.000Z",
  expiresAt: "2026-11-27T08:00:00.000Z",
};

afterEach(cleanup);

describe("SessionRow IP address", () => {
  it.each([
    null,
    "",
    " ",
    "::",
    "0.0.0.0",
    "0:0:0:0:0:0:0:0",
    "0000:0000:0000:0000:0000:0000:0000:0000",
    "0000:0::0000",
  ])("hides missing or unspecified IP %s", (ipAddress) => {
    render(
      <SessionRow session={{ ...session, ipAddress }} onRevoke={() => {}} />,
    );
    expect(
      screen.getByText(
        "settings:sessions.lastActive / settings:sessions.signedIn",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it.each(["192.0.2.4", "2001:db8::1", "::1"])(
    "shows known IP %s",
    (ipAddress) => {
      render(<SessionRow session={{ ...session, ipAddress }} />);
      expect(
        screen.getByText(
          `${ipAddress} / settings:sessions.lastActive / settings:sessions.signedIn`,
        ),
      ).toBeVisible();
    },
  );
});
