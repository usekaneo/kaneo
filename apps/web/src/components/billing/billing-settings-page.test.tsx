import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { BillingSettingsPage } from "./billing-settings-page";

const state = vi.hoisted(() => ({
  cloud: true,
  billingEnabled: false,
  credit: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    workspace: { id: "workspace", name: "Workspace" },
    isAdmin: true,
    canManageSettings: () => true,
  }),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: { isCloud: state.cloud } }),
}));
vi.mock("@/hooks/queries/billing/use-get-billing", () => ({
  useGetBilling: () => ({
    data: {
      billingEnabled: state.billingEnabled,
      foundingFree: true,
      seats: 1,
    },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/use-track-subscription", () => ({
  useTrackSubscription: () => {},
}));
vi.mock("@/hooks/queries/billing/use-ai-credit", () => ({
  useAiCredit: state.credit,
}));
vi.mock("@/hooks/mutations/billing/use-buy-ai-credit", () => ({
  useBuyAiCredit: () => ({ isPending: false, isError: false, mutate: vi.fn() }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("./current-plan-card", () => ({
  CurrentPlanCard: () => <p>Current subscription</p>,
}));
vi.mock("./plan-picker", () => ({ PlanPicker: () => null }));
vi.mock("./checkout-success-callout", () => ({
  CheckoutSuccessCallout: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.cloud = true;
  state.billingEnabled = false;
  state.credit.mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      enabled: true,
      balanceMicroUsd: "1000000",
      reservedMicroUsd: "0",
      availableMicroUsd: "1000000",
      trialGranted: true,
      multiplierBps: 15000,
      entries: [],
      topup: null,
    },
  });
});
afterEach(cleanup);

describe("AI credit without subscription billing", () => {
  it("shows cloud credit and unavailable purchases before Creem is configured", () => {
    render(
      <BillingSettingsPage checkout={undefined} onDismissCheckout={() => {}} />,
    );
    expect(screen.getByText("settings:billing.disabled")).toBeInTheDocument();
    expect(screen.getByText("settings:billing.ai.title")).toBeInTheDocument();
    expect(screen.getByText("$1.00")).toBeInTheDocument();
    expect(
      screen.getByText("settings:billing.ai.unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Current subscription")).not.toBeInTheDocument();
  });

  it("preserves the disabled subscription page on self-hosted installations", () => {
    state.cloud = false;
    render(
      <BillingSettingsPage checkout={undefined} onDismissCheckout={() => {}} />,
    );
    expect(screen.getByText("settings:billing.disabled")).toBeInTheDocument();
    expect(
      screen.queryByText("settings:billing.ai.title"),
    ).not.toBeInTheDocument();
    expect(state.credit).not.toHaveBeenCalled();
  });

  it("continues showing subscription details and credit when billing is enabled", () => {
    state.billingEnabled = true;
    render(
      <BillingSettingsPage checkout={undefined} onDismissCheckout={() => {}} />,
    );
    expect(screen.getByText("Current subscription")).toBeInTheDocument();
    expect(screen.getByText("settings:billing.ai.title")).toBeInTheDocument();
    expect(screen.getByText("$1.00")).toBeInTheDocument();
  });
});
