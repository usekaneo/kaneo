import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AdminSystemStatus } from "@/fetchers/admin/system-types";
import useSendAdminTestEmail from "@/hooks/mutations/admin/use-send-admin-test-email";
import useAdminSystemStatus from "@/hooks/queries/admin/use-admin-system-status";
import SystemStatusPanel from "./system-status-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { code?: string }) =>
      options?.code ? `${key}|${options.code}` : key,
    i18n: { language: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/admin/use-admin-system-status", () => ({
  default: vi.fn(),
}));
vi.mock("@/hooks/mutations/admin/use-send-admin-test-email", () => ({
  default: vi.fn(),
}));

const system: AdminSystemStatus = {
  checkedAt: "2026-10-26T09:30:00.000Z",
  version: "2.47.1",
  api: { status: "ok", uptimeSeconds: 3_600, nodeVersion: "v24.0.0" },
  database: {
    status: "ok",
    serverVersion: "17.2",
    latencyMs: 3,
    migrationsApplied: 66,
    errorCode: null,
  },
  realtime: {
    status: "ok",
    adapter: "in-memory",
    connections: 2,
    connectedUsers: 1,
  },
  redis: { status: "not_configured", mode: null, errorCode: null },
  email: { status: "down", configured: true, errorCode: "EAUTH" },
  storage: { status: "not_configured", configured: false, errorCode: null },
  auth: {
    passwordSignIn: true,
    emailOtpSignIn: false,
    registration: true,
    passwordRegistration: true,
    guestAccess: false,
    workspaceCreation: true,
    providers: [{ id: "custom", name: "Company SSO", status: "warning" }],
  },
  integrations: [
    {
      type: "github",
      name: "GitHub",
      status: "not_configured",
      requiresInstanceSetup: true,
      connectedProjects: 0,
    },
    {
      type: "gitea",
      name: "Gitea",
      status: "ok",
      requiresInstanceSetup: false,
      connectedProjects: 3,
    },
  ],
};

function mockStatus(value: Partial<ReturnType<typeof useAdminSystemStatus>>) {
  const refetch = vi.fn();
  vi.mocked(useAdminSystemStatus).mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch,
    ...value,
  } as unknown as ReturnType<typeof useAdminSystemStatus>);
  return refetch;
}

function mockSend(configured = {}) {
  const mutate = vi.fn();
  vi.mocked(useSendAdminTestEmail).mockReturnValue({
    mutate,
    isPending: false,
    ...configured,
  } as unknown as ReturnType<typeof useSendAdminTestEmail>);
  return mutate;
}

afterEach(cleanup);

describe("SystemStatusPanel", () => {
  it("shows placeholders while the first check runs", () => {
    mockStatus({ isLoading: true, isFetching: true });
    mockSend();

    render(<SystemStatusPanel />);

    expect(screen.getAllByTestId("settings-row-skeleton")).toHaveLength(6);
    expect(
      screen.getByRole("button", { name: /adminSystem.refreshing/ }),
    ).toBeDisabled();
  });

  it("offers a retry when the status can't be loaded", () => {
    const refetch = mockStatus({ isError: true });
    mockSend();

    render(<SystemStatusPanel />);
    fireEvent.click(screen.getByRole("button", { name: /adminSystem.retry/ }));

    expect(screen.getByText("settings:adminSystem.loadError")).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });

  it("groups each service with its status and failure code", () => {
    mockStatus({ data: system });
    mockSend();

    render(<SystemStatusPanel />);

    expect(screen.getByText("v2.47.1")).toBeTruthy();
    expect(
      screen.getByText("settings:adminSystem.email.down|EAUTH"),
    ).toBeTruthy();
    expect(
      screen.getAllByText("settings:adminSystem.status.down"),
    ).toHaveLength(1);
    expect(screen.getByText("Company SSO")).toBeTruthy();
    expect(
      screen.getByText("settings:adminSystem.setupStatus.warning"),
    ).toBeTruthy();
    expect(
      screen.getByText("settings:adminSystem.integrations.available"),
    ).toBeTruthy();
  });

  it("sends a test email only when SMTP is configured", () => {
    mockStatus({ data: system });
    const mutate = mockSend();

    render(<SystemStatusPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: /adminSystem.email.send$/ }),
    );
    expect(mutate).toHaveBeenCalledTimes(1);

    cleanup();
    mockStatus({
      data: {
        ...system,
        email: { status: "not_configured", configured: false, errorCode: null },
      },
    });
    render(<SystemStatusPanel />);
    expect(
      screen.getByRole("button", { name: /adminSystem.email.send$/ }),
    ).toBeDisabled();
  });
});
